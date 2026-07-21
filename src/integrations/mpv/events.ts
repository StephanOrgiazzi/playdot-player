import { Deferred, Effect, Schema } from "effect";
import { listenEvents } from "./libmpv-api";

class MpvEventListenerError extends Schema.TaggedErrorClass<MpvEventListenerError>()(
  "MpvEvents.ListenerError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return this.cause instanceof Error && this.cause.message
      ? this.cause.message
      : `Mpv ${this.operation} failed`;
  }
}

const attempt = Effect.fn("MpvEvents.attempt")(
  <A>(operation: string, task: () => Promise<A>): Effect.Effect<A, MpvEventListenerError> =>
    Effect.tryPromise({
      try: task,
      catch: (cause) => new MpvEventListenerError({ operation, cause }),
    }),
);

const waitForMpvEvent = Effect.fn("MpvEvents.runAndWait")(
  (eventName: string, action: () => Promise<void>, timeoutMs: number) =>
    Effect.gen(function* () {
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
            Effect.timeoutOrElse({
              duration: timeoutMs,
              orElse: () =>
                Effect.fail(
                  new MpvEventListenerError({
                    operation: "event wait",
                    cause: new Error(`Timed out waiting for mpv event: ${eventName}`),
                  }),
                ),
            }),
          ),
        (unlisten) => Effect.sync(unlisten),
      );
    }),
);

export async function runAndWaitForMpvEvent(
  eventName: string,
  action: () => Promise<void>,
  timeoutMs = 5000,
): Promise<void> {
  const program = waitForMpvEvent(eventName, action, timeoutMs).pipe(
    Effect.tapError((error) => Effect.logError(`Mpv ${error.operation} failed`, error.cause)),
  );

  await Effect.runPromise(program);
}
