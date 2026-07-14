import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createAudioNormalizerToast } from "@features/toaster/messages";
import type { ToastState } from "@features/toaster/types";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/error";

export function useAudioNormalizer({
  player,
  hasMedia,
  setError,
  setToast,
}: {
  player: MpvPlayer;
  hasMedia: boolean;
  setError: (value: string) => void;
  setToast: Dispatch<SetStateAction<ToastState | null>>;
}): {
  isAudioNormalizerEnabled: boolean;
  toggleAudioNormalizer: () => Promise<void>;
} {
  const [isAudioNormalizerEnabled, setIsAudioNormalizerEnabled] = useState(false);
  const isSwitchingRef = useRef(false);

  const toggleAudioNormalizer = useCallback(async (): Promise<void> => {
    if (!hasMedia || isSwitchingRef.current) {
      return;
    }

    isSwitchingRef.current = true;
    try {
      const enabled = !isAudioNormalizerEnabled;
      await player.setAudioNormalizerEnabled(enabled);
      setError("");
      setIsAudioNormalizerEnabled(enabled);
      setToast(createAudioNormalizerToast(enabled));
    } catch (error) {
      setError(getErrorMessage(error, "Failed to toggle audio normalizer"));
    } finally {
      isSwitchingRef.current = false;
    }
  }, [hasMedia, isAudioNormalizerEnabled, player, setError, setToast]);

  return {
    isAudioNormalizerEnabled,
    toggleAudioNormalizer,
  };
}
