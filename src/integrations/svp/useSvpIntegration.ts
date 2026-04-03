import { useCallback, useRef, useState } from "react";
import { createSvpToast } from "@features/toaster/messages";
import type { ToastState } from "@features/toaster/types";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/error";
import { resolveSvpIntegration } from "./api";
import {
  getPersistedSvpPreference,
  persistSvpPreference,
} from "./preferences";
import type { SvpIntegrationState } from "./types";

type UseSvpIntegrationOptions = {
  player: MpvPlayer;
  setError: (value: string) => void;
  setToast: (value: ToastState) => void;
};

type UseSvpIntegrationResult = {
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isSwitchingSvp: boolean;
  preparePlayerStart: () => Promise<void>;
  toggleSvp: () => Promise<void>;
};

export function useSvpIntegration({
  player,
  setError,
  setToast,
}: UseSvpIntegrationOptions): UseSvpIntegrationResult {
  const [svpPreferenceEnabled, setSvpPreferenceEnabled] = useState<boolean>(getPersistedSvpPreference);
  const [isSvpAvailable, setIsSvpAvailable] = useState(false);
  const [isSvpEnabled, setIsSvpEnabled] = useState(false);
  const [isSwitchingSvp, setIsSwitchingSvp] = useState(false);
  const isSwitchingSvpRef = useRef(false);

  const applySvpPreference = useCallback(
    async (requestedEnabled: boolean): Promise<SvpIntegrationState> => {
      const resolved = await resolveSvpIntegration(requestedEnabled);
      await player.setSvpEnabled(resolved.enabled);
      setIsSvpAvailable(resolved.available);
      setIsSvpEnabled(resolved.enabled);
      return resolved;
    },
    [player],
  );

  const preparePlayerStart = useCallback(async (): Promise<void> => {
    await applySvpPreference(svpPreferenceEnabled);
  }, [applySvpPreference, svpPreferenceEnabled]);

  const toggleSvp = useCallback(async (): Promise<void> => {
    if (isSwitchingSvpRef.current) {
      return;
    }

    const nextPreferenceEnabled = !svpPreferenceEnabled;

    isSwitchingSvpRef.current = true;
    setIsSwitchingSvp(true);
    try {
      const resolved = await applySvpPreference(nextPreferenceEnabled);
      setError("");
      setSvpPreferenceEnabled(nextPreferenceEnabled);
      persistSvpPreference(nextPreferenceEnabled);
      setToast(createSvpToast(resolved.enabled));
    } catch (error) {
      setError(getErrorMessage(error, "Failed to toggle SVP"));
    } finally {
      isSwitchingSvpRef.current = false;
      setIsSwitchingSvp(false);
    }
  }, [applySvpPreference, setError, setToast, svpPreferenceEnabled]);

  return {
    isSvpAvailable,
    isSvpEnabled,
    isSwitchingSvp,
    preparePlayerStart,
    toggleSvp,
  };
}
