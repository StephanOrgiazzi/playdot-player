import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Effect, Fiber, Option, Schedule, Schema } from "effect";
import { createMpvThumbnailConfig, getMpvLoadOptionsForSource } from "./config";
import { command, destroy, init } from "./libmpv-api";

const THUMBNAIL_INSTANCE_LABEL = "thumbnail-worker";
const EXACT_SEEK_DELAY_MS = 120;
const FRAME_POLL_INTERVAL_MS = 18;
const MAX_FRAME_POLLS = 20;
const framePollSchedule = Schedule.spaced(FRAME_POLL_INTERVAL_MS).pipe(
  Schedule.upTo({ times: MAX_FRAME_POLLS - 1 }),
);

const ThumbnailTarget = Schema.Struct({
  rawPath: Schema.String,
  imagePath: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
});

interface ThumbnailTarget extends Schema.Schema.Type<typeof ThumbnailTarget> {}

type PendingSeek = {
  seconds: number;
  exact: boolean;
  revision: number;
};

type WorkerPreparation = "existing" | "started";
type ThumbnailListener = (url: string) => void;

class ThumbnailError extends Schema.TaggedErrorClass<ThumbnailError>()("MpvThumbnailer.Error", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return this.cause instanceof Error && this.cause.message
      ? this.cause.message
      : `Thumbnail ${this.operation} failed`;
  }
}

const attempt = Effect.fn("MpvThumbnailer.attempt")(
  <A>(operation: string, task: () => Promise<A>): Effect.Effect<A, ThumbnailError> =>
    Effect.tryPromise({
      try: task,
      catch: (cause) => new ThumbnailError({ operation, cause }),
    }),
);

const reportError = (error: ThumbnailError): Effect.Effect<void> =>
  Effect.logError(`Thumbnail ${error.operation} failed`, error.cause);

const decodeThumbnailTarget = Schema.decodeUnknownEffect(ThumbnailTarget);
const decodeBoolean = Schema.decodeUnknownEffect(Schema.Boolean);

export class MpvThumbnailer {
  private source: string | null = null;
  private startedSource: string | null = null;
  private target: ThumbnailTarget | null = null;
  private listeners = new Set<ThumbnailListener>();
  private currentUrl = "";
  private active = false;
  private pendingSeek: PendingSeek | null = null;
  private workerStarted = false;
  private exactSeekFiber: Fiber.Fiber<void> | null = null;
  private renderFiber: Fiber.Fiber<void> | null = null;
  private frameRevision = 0;
  private requestRevision = 0;
  private lifecycleToken = 0;
  private teardown: Promise<void> = Promise.resolve();

  subscribe(listener: ThumbnailListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUrl);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setSource(source: string | null): void {
    if (source === this.source) {
      return;
    }

    this.source = source;
    this.lifecycleToken += 1;
    this.clear();
    this.queueTeardown();
  }

  request(seconds: number): void {
    if (!this.source || !Number.isFinite(seconds)) {
      return;
    }

    const normalizedSeconds = Math.max(0, seconds);
    const revision = ++this.requestRevision;
    this.active = true;
    this.pendingSeek = { seconds: normalizedSeconds, exact: false, revision };
    this.scheduleExactSeek(normalizedSeconds, revision);
    this.startRender();
  }

  clear(): void {
    this.requestRevision += 1;
    this.active = false;
    this.pendingSeek = null;
    this.interruptExactSeek();
    this.emit("");
  }

  async stop(): Promise<void> {
    this.source = null;
    this.lifecycleToken += 1;
    this.clear();
    this.queueTeardown();
    await this.teardown;
  }

  private emit(url: string): void {
    if (url === this.currentUrl) {
      return;
    }

    this.currentUrl = url;
    for (const listener of this.listeners) {
      listener(url);
    }
  }

  private scheduleExactSeek(seconds: number, revision: number): void {
    this.interruptExactSeek();
    const fiber = Effect.runFork(
      Effect.sync(() => {
        if (this.exactSeekFiber === fiber) {
          this.exactSeekFiber = null;
        }
        if (!this.active || revision !== this.requestRevision) {
          return;
        }
        this.pendingSeek = { seconds, exact: true, revision };
        this.startRender();
      }).pipe(Effect.delay(EXACT_SEEK_DELAY_MS)),
    );
    this.exactSeekFiber = fiber;
  }

  private interruptExactSeek(): void {
    if (this.exactSeekFiber) {
      Effect.runFork(Fiber.interrupt(this.exactSeekFiber));
      this.exactSeekFiber = null;
    }
  }

  private startRender(): void {
    if (this.renderFiber) {
      return;
    }

    const render = this.flush().pipe(
      Effect.matchEffect({
        onFailure: reportError,
        onSuccess: () => Effect.void,
      }),
      Effect.ensuring(
        Effect.sync(() => {
          this.renderFiber = null;
          if (this.pendingSeek && this.active) {
            this.startRender();
          }
        }),
      ),
    );
    this.renderFiber = Effect.runFork(render);
  }

  private readonly flush = Effect.fn("MpvThumbnailer.flush")(() =>
    Effect.gen({ self: this }, function* () {
      while (this.pendingSeek) {
        const pending = this.pendingSeek;
        this.pendingSeek = null;
        const token = this.lifecycleToken;
        const url = yield* this.renderFrame(pending, token);
        if (
          url &&
          this.active &&
          token === this.lifecycleToken &&
          pending.revision === this.requestRevision
        ) {
          this.emit(url);
        }
        if (token !== this.lifecycleToken) {
          return;
        }
      }
    }),
  );

  private readonly renderFrame = Effect.fn("MpvThumbnailer.renderFrame")(
    (pending: PendingSeek, token: number): Effect.Effect<string | null, ThumbnailError> =>
      Effect.gen({ self: this }, function* () {
        const preparation = yield* this.ensureStarted(token, pending);
        if (!preparation || !this.target) {
          return null;
        }

        const target = this.target;
        if (preparation === "existing") {
          yield* attempt("frame discard", () =>
            invoke("discard_thumbnail_frame", { rawPath: target.rawPath }),
          );
          yield* attempt("seek", () =>
            command(
              "seek",
              [pending.seconds, pending.exact ? "absolute+exact" : "absolute+keyframes"],
              undefined,
              THUMBNAIL_INSTANCE_LABEL,
            ),
          );
        }

        const pollFrame = Effect.gen({ self: this }, function* () {
          if (!this.active || token !== this.lifecycleToken) {
            return Option.some<string | null>(null);
          }

          const readyPayload = yield* attempt("frame promotion", () =>
            invoke<boolean>("promote_thumbnail_frame", {
              rawPath: target.rawPath,
              imagePath: target.imagePath,
            }),
          );
          const ready = yield* decodeBoolean(readyPayload).pipe(
            Effect.mapError(
              (cause) =>
                new ThumbnailError({ operation: "frame promotion response decoding", cause }),
            ),
          );
          if (ready) {
            this.frameRevision += 1;
            return Option.some<string | null>(
              `${convertFileSrc(target.imagePath)}?frame=${this.frameRevision}`,
            );
          }

          return Option.none<string | null>();
        });

        const result = yield* pollFrame.pipe(
          Effect.delay(FRAME_POLL_INTERVAL_MS),
          Effect.repeat({
            schedule: framePollSchedule,
            until: Option.isSome,
          }),
        );
        return Option.getOrNull(result);
      }),
  );

  private readonly ensureStarted = Effect.fn("MpvThumbnailer.ensureStarted")(
    (
      token: number,
      initialSeek: PendingSeek,
    ): Effect.Effect<WorkerPreparation | null, ThumbnailError> =>
      Effect.gen({ self: this }, function* () {
        const source = this.source;
        const pendingTeardown = this.teardown;
        if (!source || token !== this.lifecycleToken) {
          return null;
        }
        if (this.startedSource === source && this.target) {
          return "existing";
        }

        yield* Effect.promise(() => pendingTeardown);
        if (source !== this.source || token !== this.lifecycleToken) {
          return null;
        }

        const targetPayload = yield* attempt("target creation", () =>
          invoke<ThumbnailTarget>("create_thumbnail_target"),
        );
        const target = yield* decodeThumbnailTarget(targetPayload).pipe(
          Effect.mapError(
            (cause) => new ThumbnailError({ operation: "target response decoding", cause }),
          ),
        );
        this.target = target;
        yield* this.startWorker(source, target, initialSeek).pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              this.queueTeardown();
            }),
          ),
        );
        if (source !== this.source || token !== this.lifecycleToken) {
          return null;
        }
        this.startedSource = source;
        return "started";
      }),
  );

  private readonly startWorker = Effect.fn("MpvThumbnailer.startWorker")(
    (source: string, target: ThumbnailTarget, initialSeek: PendingSeek) =>
      Effect.gen({ self: this }, function* () {
        const config = createMpvThumbnailConfig(target, initialSeek);
        yield* attempt("worker initialization", () =>
          init(config, undefined, THUMBNAIL_INSTANCE_LABEL),
        );
        this.workerStarted = true;
        const loadOptions = getMpvLoadOptionsForSource(source, "thumbnail");
        yield* attempt("media loading", () =>
          command(
            "loadfile",
            loadOptions ? [source, "replace", -1, loadOptions] : [source],
            undefined,
            THUMBNAIL_INSTANCE_LABEL,
          ),
        );
      }),
  );

  private queueTeardown(): void {
    this.startedSource = null;
    const previousTeardown = this.teardown;
    const activeRender = this.renderFiber;
    const teardown = Effect.gen({ self: this }, function* () {
      yield* Effect.promise(() => previousTeardown);
      if (activeRender) {
        yield* Fiber.await(activeRender);
      }
      yield* this.destroyWorker();
    });
    this.teardown = Effect.runPromise(teardown);
  }

  private readonly destroyWorker = Effect.fn("MpvThumbnailer.destroyWorker")(() => {
    const target = this.target;
    this.target = null;
    this.startedSource = null;

    const destroyWorker = this.workerStarted
      ? attempt("worker shutdown", () => destroy(undefined, THUMBNAIL_INSTANCE_LABEL)).pipe(
          Effect.matchEffect({
            onFailure: reportError,
            onSuccess: () => Effect.void,
          }),
        )
      : Effect.void;
    this.workerStarted = false;

    const removeTarget = target
      ? attempt("target removal", () =>
          invoke("remove_thumbnail_target", {
            rawPath: target.rawPath,
            imagePath: target.imagePath,
          }),
        ).pipe(
          Effect.matchEffect({
            onFailure: reportError,
            onSuccess: () => Effect.void,
          }),
        )
      : Effect.void;

    return destroyWorker.pipe(Effect.andThen(removeTarget));
  });
}
