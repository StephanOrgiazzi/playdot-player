import { Cause, Data, Deferred, Effect, Option } from "effect";
import { listenEvents } from "./libmpv-api";

class MpvEventListenerError extends Data.TaggedError("MpvEventListenerError")<{
  readonly operation: string;
  readonly cause: Cause.UnknownError;
}> {}

const attempt = <A>(
  operation: string,
  task: () => Promise<A>,
): Effect.Effect<A, MpvEventListenerError> =>
  Effect.tryPromise({
    try: task,
    catch: (cause) =>
      new MpvEventListenerError({
        operation,
        cause: new Cause.UnknownError(cause),
      }),
  });

export async function runAndWaitForMpvEvent(
  eventName: string,
  action: () => Promise<void>,
  timeoutMs = 5000,
): Promise<void> {
  const program = Effect.gen(function* () {
    const received = yield* Deferred.make<void>();
    yield* Effect.acquireUseRelease(
      attempt("listener registration", () =>
        listenEvents((event) => {
          if (event.event === eventName) {
            Effect.runSync(Deferred.succeed(received, undefined));
          }
        }),
      ),
      () =>
        attempt("event trigger", action).pipe(
          Effect.andThen(Deferred.await(received)),
          Effect.timeoutOption(timeoutMs),
          Effect.flatMap((result) =>
            Option.isSome(result)
              ? Effect.void
              : Effect.fail(
                  new MpvEventListenerError({
                    operation: "event wait",
                    cause: new Cause.UnknownError(
                      new Error(`Timed out waiting for mpv event: ${eventName}`),
                    ),
                  }),
                ),
          ),
        ),
      (unlisten) => Effect.sync(unlisten),
    );
  }).pipe(
    Effect.tapError((error) => Effect.logError(`Mpv ${error.operation} failed`, error.cause)),
  );

  await Effect.runPromise(program);
}
