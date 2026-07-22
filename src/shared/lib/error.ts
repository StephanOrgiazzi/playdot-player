export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function toError(error: unknown): Error | null {
  return error instanceof Error ? error : null;
}
