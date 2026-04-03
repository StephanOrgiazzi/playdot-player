export function getPersistedBoolean(key: string): boolean {
  try {
    return (window.localStorage.getItem(key) ?? "true") === "true";
  } catch {
    return true;
  }
}

export function persistBoolean(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, `${value}`);
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}
