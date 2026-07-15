import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createAudioNormalizerToast } from "@features/toaster/messages";
import type { ToastState } from "@features/toaster/types";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { playerCommand, runPlayerCommand } from "./playerCommand";

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
  toggleAudioNormalizer: () => void;
} {
  const [isAudioNormalizerEnabled, setIsAudioNormalizerEnabled] = useState(false);
  const isSwitchingRef = useRef(false);

  const toggleAudioNormalizer = useCallback((): void => {
    if (!hasMedia || isSwitchingRef.current) {
      return;
    }

    isSwitchingRef.current = true;
    runPlayerCommand(
      playerCommand("Failed to toggle audio normalizer", async () => {
        try {
          const enabled = !isAudioNormalizerEnabled;
          await player.setAudioNormalizerEnabled(enabled);
          setError("");
          setIsAudioNormalizerEnabled(enabled);
          setToast(createAudioNormalizerToast(enabled));
        } finally {
          isSwitchingRef.current = false;
        }
      }),
      setError,
    );
  }, [hasMedia, isAudioNormalizerEnabled, player, setError, setToast]);

  return {
    isAudioNormalizerEnabled,
    toggleAudioNormalizer,
  };
}
