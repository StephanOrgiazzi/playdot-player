const ERROR_MESSAGE_KEYS = ["message", "error", "cause"] as const;

function readErrorMessage(value: unknown, depth: number): string | null {
  if (typeof value === "string") {
    const message = value.trim();
    return message.length > 0 ? message : null;
  }

  if (value instanceof Error) {
    const message = value.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  if (depth <= 0 || typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of ERROR_MESSAGE_KEYS) {
    const message = readErrorMessage(record[key], depth - 1);
    if (message) {
      return message;
    }
  }

  return null;
}

export function getErrorMessage(value: unknown): string | null {
  return readErrorMessage(value, 3);
}
