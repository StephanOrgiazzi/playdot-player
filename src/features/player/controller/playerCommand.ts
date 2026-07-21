import { useCallback, useEffect, useRef } from "react";
import { Effect, Queue, Schema, Stream } from "effect";

export class PlayerCommandError extends Schema.TaggedErrorClass<PlayerCommandError>()(
  "PlayerCommand.Error",
  {
    fallbackMessage: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return this.cause instanceof Error && this.cause.message
      ? this.cause.message
      : this.fallbackMessage;
  }
}

export const playerCommand = Effect.fn("PlayerCommand.execute")(
  (fallbackMessage: string, task: () => Promise<void>): Effect.Effect<void, PlayerCommandError> =>
    Effect.tryPromise({
      try: task,
      catch: (cause) => new PlayerCommandError({ fallbackMessage, cause }),
    }),
);

export function runPlayerCommand(
  command: Effect.Effect<void, PlayerCommandError>,
  setError: (message: string) => void,
): void {
  Effect.runCallback(handlePlayerCommand(command, setError));
}

const handlePlayerCommand = Effect.fn("PlayerCommand.handle")(
  (
    command: Effect.Effect<void, PlayerCommandError>,
    setError: (message: string) => void,
  ): Effect.Effect<void> =>
    command.pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          setError(error.message);
        }).pipe(Effect.andThen(Effect.logError(error.fallbackMessage, error))),
      ),
    ),
);

export function useLatestPlayerCommand(setError: (message: string) => void): {
  runLatest: (command: Effect.Effect<void, PlayerCommandError>) => void;
} {
  const queueRef = useRef<Queue.Queue<Effect.Effect<void, PlayerCommandError>> | null>(null);
  if (!queueRef.current) {
    queueRef.current = Effect.runSync(Queue.sliding<Effect.Effect<void, PlayerCommandError>>(1));
  }
  const queue = queueRef.current;

  useEffect(() => {
    const worker = Stream.fromQueue(queue).pipe(
      Stream.runForEach((command) => handlePlayerCommand(command, setError)),
    );
    return Effect.runCallback(worker);
  }, [queue, setError]);

  const runLatest = useCallback(
    (command: Effect.Effect<void, PlayerCommandError>): void => {
      Effect.runSync(Queue.offer(queue, command));
    },
    [queue],
  );

  return { runLatest };
}
