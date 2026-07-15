import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Cause, Data, Effect, Fiber } from "effect";
import { command, destroy, init, type MpvConfig } from "./libmpv-api";

const THUMBNAIL_INSTANCE_LABEL = "thumbnail-worker";
const EXACT_SEEK_DELAY_MS = 120;
const FRAME_POLL_INTERVAL_MS = 18;
const MAX_FRAME_POLLS = 20;

type ThumbnailTarget = {
  rawPath: string;
  imagePath: string;
  width: number;
  height: number;
};

type PendingSeek = {
  seconds: number;
  exact: boolean;
  revision: number;
};

type WorkerPreparation = "existing" | "started";
type ThumbnailListener = (url: string) => void;

class ThumbnailError extends Data.TaggedError("ThumbnailError")<{
  readonly operation: string;
  readonly cause: Cause.UnknownError;
}> {}

const attempt = <A>(operation: string, task: () => Promise<A>): Effect.Effect<A, ThumbnailError> =>
  Effect.tryPromise({
    try: task,
    catch: (cause) => new ThumbnailError({ operation, cause: new Cause.UnknownError(cause) }),
  });

const reportError = (error: ThumbnailError): Effect.Effect<void> =>
  Effect.logError(`Thumbnail ${error.operation} failed`, error.cause);

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
      Effect.sleep(EXACT_SEEK_DELAY_MS).pipe(
        Effect.andThen(
          Effect.sync(() => {
            if (this.exactSeekFiber === fiber) {
              this.exactSeekFiber = null;
            }
            if (!this.active || revision !== this.requestRevision) {
              return;
            }
            this.pendingSeek = { seconds, exact: true, revision };
            this.startRender();
          }),
        ),
      ),
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

  private flush(): Effect.Effect<void, ThumbnailError> {
    return Effect.gen({ self: this }, function* () {
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
    });
  }

  private renderFrame(
    pending: PendingSeek,
    token: number,
  ): Effect.Effect<string | null, ThumbnailError> {
    return Effect.gen({ self: this }, function* () {
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

      for (let poll = 0; poll < MAX_FRAME_POLLS; poll += 1) {
        yield* Effect.sleep(FRAME_POLL_INTERVAL_MS);
        if (!this.active || token !== this.lifecycleToken) {
          return null;
        }

        const ready = yield* attempt("frame promotion", () =>
          invoke<boolean>("promote_thumbnail_frame", {
            rawPath: target.rawPath,
            imagePath: target.imagePath,
          }),
        );
        if (ready) {
          this.frameRevision += 1;
          return `${convertFileSrc(target.imagePath)}?frame=${this.frameRevision}`;
        }
      }

      return null;
    });
  }

  private ensureStarted(
    token: number,
    initialSeek: PendingSeek,
  ): Effect.Effect<WorkerPreparation | null, ThumbnailError> {
    return Effect.gen({ self: this }, function* () {
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

      const target = yield* attempt("target creation", () =>
        invoke<ThumbnailTarget>("create_thumbnail_target"),
      );
      this.target = target;
      const startWorker = Effect.gen({ self: this }, function* () {
        yield* attempt("worker initialization", () =>
          init(this.createConfig(target, initialSeek), undefined, THUMBNAIL_INSTANCE_LABEL),
        );
        this.workerStarted = true;
        yield* attempt("media loading", () =>
          command("loadfile", [source], undefined, THUMBNAIL_INSTANCE_LABEL),
        );
      });

      yield* startWorker.pipe(
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
    });
  }

  private createConfig(target: ThumbnailTarget, initialSeek: PendingSeek): MpvConfig {
    return {
      initialOptions: {
        idle: "yes",
        pause: "yes",
        "keep-open": "always",
        start: initialSeek.seconds,
        "hr-seek": initialSeek.exact ? "yes" : "no",
        audio: "no",
        sub: "no",
        hwdec: "no",
        "demuxer-readahead-secs": 0,
        "demuxer-max-bytes": "128KiB",
        "vd-lavc-skiploopfilter": "all",
        "vd-lavc-fast": "yes",
        "vd-lavc-threads": 2,
        "sws-scaler": "fast-bilinear",
        "target-trc": "srgb",
        "target-prim": "bt.709",
        vf: `gpu=api=vulkan:w=${target.width}:h=${target.height},format=fmt=bgra`,
        ovc: "rawvideo",
        of: "image2",
        ofopts: "update=1",
        o: target.rawPath,
      },
    };
  }

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

  private destroyWorker(): Effect.Effect<void> {
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
  }
}
