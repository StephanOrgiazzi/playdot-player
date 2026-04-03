export function getErrorMessage<T>(error: T, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function toError<T>(error: T): Error | null {
  return error instanceof Error ? error : null;
}
