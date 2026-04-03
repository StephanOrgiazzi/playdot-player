const FSR_PREFERENCE_STORAGE_KEY = "playdot-player.player.fsr-enabled";

export function getPersistedFsrPreference(): boolean {
  try {
    const storedValue = window.localStorage.getItem(FSR_PREFERENCE_STORAGE_KEY);
    if (storedValue === null) {
      return true;
    }

    return storedValue === "true";
  } catch {
    return true;
  }
}

export function persistFsrPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(FSR_PREFERENCE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}
