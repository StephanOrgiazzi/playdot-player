import { useCallback, useEffect, useRef } from "react";
import { Effect, Queue } from "effect";

export class PlayerCommandError extends Error {
  readonly _tag = "PlayerCommandError";

  constructor(
    readonly fallbackMessage: string,
    override readonly cause: Error,
  ) {
    super(cause.message || fallbackMessage, { cause });
  }
}

export function playerCommand(
  fallbackMessage: string,
  task: () => Promise<void>,
): Effect.Effect<void, PlayerCommandError> {
  return Effect.tryPromise({
    try: task,
    catch: (cause) =>
      new PlayerCommandError(
        fallbackMessage,
        cause instanceof Error ? cause : new Error(String(cause)),
      ),
  });
}

export function runPlayerCommand(
  command: Effect.Effect<void, PlayerCommandError>,
  setError: (message: string) => void,
): void {
  Effect.runCallback(handlePlayerCommand(command, setError));
}

function handlePlayerCommand(
  command: Effect.Effect<void, PlayerCommandError>,
  setError: (message: string) => void,
): Effect.Effect<void> {
  return command.pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        setError(error.message);
      }).pipe(Effect.andThen(Effect.logError(error.fallbackMessage, error))),
    ),
  );
}

export function useLatestPlayerCommand(setError: (message: string) => void): {
  runLatest: (command: Effect.Effect<void, PlayerCommandError>) => void;
} {
  const queueRef = useRef<Queue.Queue<Effect.Effect<void, PlayerCommandError>> | null>(null);
  if (!queueRef.current) {
    queueRef.current = Effect.runSync(Queue.sliding<Effect.Effect<void, PlayerCommandError>>(1));
  }
  const queue = queueRef.current;

  useEffect(() => {
    const worker = Effect.forever(
      Queue.take(queue).pipe(Effect.flatMap((command) => handlePlayerCommand(command, setError))),
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
