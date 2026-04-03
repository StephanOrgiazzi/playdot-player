const SVP_PREFERENCE_STORAGE_KEY = "playdot-player.player.svp-enabled";

export function getPersistedSvpPreference(): boolean {
  try {
    const storedValue = window.localStorage.getItem(SVP_PREFERENCE_STORAGE_KEY);
    if (storedValue === null) {
      return true;
    }

    return storedValue === "true";
  } catch {
    return true;
  }
}

export function persistSvpPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(SVP_PREFERENCE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}
