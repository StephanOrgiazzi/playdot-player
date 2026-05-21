export function getPersistedBoolean(key: string, fallback = true): boolean {
  try {
    return (window.localStorage.getItem(key) ?? `${fallback}`) === "true";
  } catch {
    return fallback;
  }
}

export function persistBoolean(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, `${value}`);
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}
