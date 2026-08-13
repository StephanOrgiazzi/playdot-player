export function getErrorMessage(error: Error | null, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function toError(error: Error | null): Error | null {
  return error instanceof Error ? error : null;
}
