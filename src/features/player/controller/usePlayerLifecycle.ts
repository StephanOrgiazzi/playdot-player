import { useEffect, useEffectEvent, type Dispatch, type SetStateAction } from "react";
import { Effect, FiberSet, Queue, Semaphore } from "effect";
import { getStartupMediaSource } from "@features/mediaOpen/startup";
import { listen } from "@tauri-apps/api/event";
import type { Window } from "@tauri-apps/api/window";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UsePlayerLifecycleOptions = {
  player: MpvPlayer;
  appWindow: Window;
  setError: StateSetter<string>;
  syncWindowState: () => Promise<void>;
  beforeStart?: () => Promise<void>;
};

type MediaSourceRequest = {
  source: string;
  failureMessage: string;
};

class PlayerLifecycleError extends Error {
  readonly _tag = "PlayerLifecycleError";

  constructor(
    readonly operation: string,
    message: string,
    cause: object,
  ) {
    super(message, { cause });
  }
}

const playerLifecycleSemaphore = Semaphore.makeUnsafe(1);

function lifecyclePromise<A>(
  operation: string,
  message: string,
  task: () => PromiseLike<A>,
): Effect.Effect<A, PlayerLifecycleError> {
  return Effect.tryPromise({
    try: task,
    catch: (cause) =>
      new PlayerLifecycleError(
        operation,
        message,
        cause instanceof Error ? cause : new Error(String(cause)),
      ),
  });
}

export function usePlayerLifecycle({
  player,
  appWindow,
  setError,
  syncWindowState,
  beforeStart,
}: UsePlayerLifecycleOptions): void {
  const runBeforeStart = useEffectEvent((): Promise<void> => beforeStart?.() ?? Promise.resolve());

  useEffect(() => {
    let mounted = true;

    const reportFailure = (error: PlayerLifecycleError): Effect.Effect<void> =>
      Effect.sync(() => {
        if (mounted) {
          setError(error.message);
        }
      }).pipe(Effect.andThen(Effect.logError(error.operation, error)));

    const loadMediaSource = ({ source, failureMessage }: MediaSourceRequest): Effect.Effect<void> =>
      lifecyclePromise("load media source", failureMessage, () => player.loadFile(source)).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            if (mounted) {
              setError("");
            }
          }),
        ),
        Effect.catch(reportFailure),
      );

    const optionalListener = (
      acquisition: Effect.Effect<() => void, PlayerLifecycleError>,
    ): Effect.Effect<() => void> =>
      acquisition.pipe(
        Effect.catch((error) => reportFailure(error).pipe(Effect.as(() => undefined))),
      );

    const stopPlayer = lifecyclePromise("stop player", "Failed to stop mpv", () =>
      player.stop(),
    ).pipe(Effect.catch((error) => Effect.logError(error.operation, error)));

    const lifecycle = Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() => stopPlayer);
        const runScoped = yield* FiberSet.makeRuntime<never, void, never>();
        const mediaSources = yield* Queue.sliding<MediaSourceRequest>(1);
        const windowResizes = yield* Queue.sliding<void>(1);
        const offerMediaSource = (request: MediaSourceRequest): void => {
          Effect.runSync(Queue.offer(mediaSources, request));
        };

        let autoCloseStarted = false;
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            player.subscribe((next) => {
              if (!mounted || autoCloseStarted || !next.filename || !next.eofReached) {
                return;
              }

              autoCloseStarted = true;
              runScoped(
                lifecyclePromise("close window", "Failed to close window", () =>
                  appWindow.close(),
                ).pipe(Effect.catch((error) => Effect.logError(error.operation, error))),
              );
            }),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        );

        yield* Effect.acquireRelease(
          optionalListener(
            lifecyclePromise("register drag listener", "Failed to listen for dropped media", () =>
              appWindow.onDragDropEvent((event) => {
                if (event.payload.type !== "drop") {
                  return;
                }

                const [path] = event.payload.paths;
                if (path) {
                  offerMediaSource({ source: path, failureMessage: "Failed to play dropped file" });
                }
              }),
            ),
          ),
          (unlisten) => Effect.sync(unlisten),
        );

        yield* Effect.acquireRelease(
          optionalListener(
            lifecyclePromise("register resize listener", "Failed to listen for window resize", () =>
              appWindow.onResized(() => {
                Effect.runSync(Queue.offer(windowResizes, undefined));
              }),
            ),
          ),
          (unlisten) => Effect.sync(unlisten),
        );

        yield* Effect.acquireRelease(
          optionalListener(
            lifecyclePromise(
              "register media source listener",
              "Failed to listen for media sources",
              () =>
                listen<string>("open-media-source", (event) => {
                  offerMediaSource({
                    source: event.payload,
                    failureMessage: "Failed to open launch media",
                  });
                }),
            ),
          ),
          (unlisten) => Effect.sync(unlisten),
        );

        const startupMediaSource = yield* lifecyclePromise(
          "read startup media source",
          "Failed to read launch media",
          getStartupMediaSource,
        ).pipe(Effect.catch(reportFailure));
        if (startupMediaSource) {
          offerMediaSource({
            source: startupMediaSource,
            failureMessage: "Failed to open launch media",
          });
        }

        yield* Effect.uninterruptible(
          lifecyclePromise(
            "prepare player",
            "Failed to prepare player integrations",
            runBeforeStart,
          ).pipe(
            Effect.andThen(
              lifecyclePromise("start player", "Failed to initialize mpv", () => player.start()),
            ),
          ),
        );

        yield* Effect.forkScoped(
          Effect.forever(Queue.take(mediaSources).pipe(Effect.flatMap(loadMediaSource))),
        );
        yield* Effect.forkScoped(
          Effect.forever(
            Queue.take(windowResizes).pipe(
              Effect.flatMap(() =>
                lifecyclePromise(
                  "synchronize window state",
                  "Failed to synchronize window state",
                  syncWindowState,
                ).pipe(Effect.catch(reportFailure)),
              ),
            ),
          ),
        );
        yield* Queue.offer(windowResizes, undefined);
        yield* Effect.never;
      }).pipe(Effect.catch(reportFailure)),
    );

    const interrupt = Effect.runCallback(playerLifecycleSemaphore.withPermit(lifecycle));
    return () => {
      mounted = false;
      interrupt();
    };
  }, [appWindow, player, setError, syncWindowState]);
}
