import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { playerCommand, runPlayerCommand } from "@features/player/controller/playerCommand";
import { getPersistedBoolean, persistBoolean } from "@shared/lib/persistedBoolean";

const MODERN_INTERFACE_STORAGE_KEY = "playdot-player.interface.modern-enabled";

function applyModernInterfacePreference(enabled: boolean): Promise<void> {
  return invoke("set_modern_interface_enabled", { enabled });
}

export function useModernInterface(setError: (message: string) => void) {
  const [isModernInterfaceEnabled, setIsModernInterfaceEnabled] = useState(() =>
    getPersistedBoolean(MODERN_INTERFACE_STORAGE_KEY),
  );
  const initialPreferenceRef = useRef(isModernInterfaceEnabled);
  const isSwitchingRef = useRef(false);

  useEffect(() => {
    runPlayerCommand(
      playerCommand("Failed to apply the modern interface preference", () =>
        applyModernInterfacePreference(initialPreferenceRef.current),
      ),
      setError,
    );
  }, [setError]);

  const toggleModernInterface = useCallback((): void => {
    if (isSwitchingRef.current) {
      return;
    }

    const nextEnabled = !isModernInterfaceEnabled;
    isSwitchingRef.current = true;
    runPlayerCommand(
      playerCommand("Failed to toggle the modern interface", async () => {
        try {
          await applyModernInterfacePreference(nextEnabled);
          setError("");
          setIsModernInterfaceEnabled(nextEnabled);
          persistBoolean(MODERN_INTERFACE_STORAGE_KEY, nextEnabled);
        } finally {
          isSwitchingRef.current = false;
        }
      }),
      setError,
    );
  }, [isModernInterfaceEnabled, setError]);

  return { isModernInterfaceEnabled, toggleModernInterface };
}
