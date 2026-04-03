export function getErrorMessage<T>(error: T, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
