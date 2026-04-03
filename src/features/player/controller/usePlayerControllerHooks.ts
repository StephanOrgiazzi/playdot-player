import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createMediaOpenActions } from "@features/mediaOpen/actions";
import { createFsrToast, createGammaToast, createVolumeToast } from "@features/toaster/messages";
import type { ToastState, TrackKind } from "@features/toaster/types";
import { usePendingTrackToast } from "@features/toaster/useToastEffects";
import { clampUiVolume, getMpvVolumeFromUiVolume, getUiVolumeFromMpvVolume } from "@integrations/mpv/constants";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/error";
import { formatTime } from "@shared/lib/format";
import { getPersistedBoolean, persistBoolean } from "@shared/lib/persistedBoolean";
import { getPlayerTrackDerivedState } from "../model/playerDerived";
import { hasMedia as hasLoadedMedia } from "../model/playerSelectors";
import { usePlayerStateSelector } from "../model/playerStore";

const FSR_PREFERENCE_STORAGE_KEY = "playdot-player.player.fsr-enabled";
const GAMMA_STEP = 1;

type SetError = (value: string) => void;
type SetToast = Dispatch<SetStateAction<ToastState | null>>;

async function applyFsrAction({
  errorMessage,
  setError,
  setIsFsrEnabled,
  setToast,
  showToast = true,
  onSuccess,
  task,
}: {
  errorMessage: string;
  setError: SetError;
  setIsFsrEnabled: (value: boolean) => void;
  setToast: SetToast;
  showToast?: boolean;
  onSuccess?: (enabled: boolean) => void;
  task: () => Promise<boolean>;
}): Promise<void> {
  try {
    const enabled = await task();
    setError("");
    setIsFsrEnabled(enabled);
    if (showToast) {
      setToast(createFsrToast(enabled));
    }
    onSuccess?.(enabled);
  } catch (error) {
    setError(getErrorMessage(error, errorMessage));
  }
}

async function applyVolumeAction({
  player,
  hasMedia,
  delta,
  setToast,
}: {
  player: MpvPlayer;
  hasMedia: boolean;
  delta: number;
  setToast: SetToast;
}): Promise<void> {
  if (!hasMedia) {
    return;
  }

  const nextDisplayVolume = clampUiVolume(getUiVolumeFromMpvVolume(player.getVolume()) + delta);
  await player.setVolume(getMpvVolumeFromUiVolume(nextDisplayVolume));
  setToast(createVolumeToast(nextDisplayVolume));
}

function useTrackCycleAction({
  cycleTrack,
  errorMessage,
  isCycling,
  kind,
  setError,
  setIsCycling,
  setPendingTrackToast,
}: {
  cycleTrack: () => Promise<void>;
  errorMessage: string;
  isCycling: boolean;
  kind: TrackKind;
  setError: SetError;
  setIsCycling: (value: boolean) => void;
  setPendingTrackToast: (value: TrackKind) => void;
}): () => Promise<void> {
  return useCallback(async (): Promise<void> => {
    if (isCycling) {
      return;
    }

    setIsCycling(true);
    try {
      await cycleTrack();
      setError("");
      setPendingTrackToast(kind);
    } catch (error) {
      setError(getErrorMessage(error, errorMessage));
    } finally {
      setIsCycling(false);
    }
  }, [cycleTrack, errorMessage, isCycling, kind, setError, setIsCycling, setPendingTrackToast]);
}

function useSavedFsrPreferenceSync({
  player,
  hasMedia,
  filename,
  fsrPreferenceEnabled,
  isFsrEnabled,
  setError,
  setIsFsrEnabled,
  setToast,
}: {
  player: MpvPlayer;
  hasMedia: boolean;
  filename: string;
  fsrPreferenceEnabled: boolean;
  isFsrEnabled: boolean;
  setError: SetError;
  setIsFsrEnabled: (value: boolean) => void;
  setToast: SetToast;
}): void {
  const lastFsrSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const fsrSyncKey = hasMedia ? `${filename}:${fsrPreferenceEnabled}` : null;
    if (!fsrSyncKey) {
      lastFsrSyncKeyRef.current = null;
      return;
    }
    if (lastFsrSyncKeyRef.current === fsrSyncKey || isFsrEnabled === fsrPreferenceEnabled) {
      return;
    }
    lastFsrSyncKeyRef.current = fsrSyncKey;
    void applyFsrAction({
      errorMessage: "Failed to apply saved FSR setting",
      setError,
      setIsFsrEnabled,
      setToast,
      showToast: false,
      task: () => player.toggleFsr(),
    });
  }, [filename, fsrPreferenceEnabled, hasMedia, isFsrEnabled, player, setError, setIsFsrEnabled, setToast]);
}

export function usePlayerMediaState(): {
  initialized: boolean;
  paused: boolean;
  duration: number;
  filename: string;
  hasMedia: boolean;
  totalTime: string;
  audioTracks: ReturnType<typeof getPlayerTrackDerivedState>["audioTracks"];
  subtitleTracks: ReturnType<typeof getPlayerTrackDerivedState>["subtitleTracks"];
  selectedAudioTrack: ReturnType<typeof getPlayerTrackDerivedState>["selectedAudioTrack"];
  selectedSubtitleTrack: ReturnType<typeof getPlayerTrackDerivedState>["selectedSubtitleTrack"];
  audioSummary: string;
  subtitleSummary: string;
} {
  const initialized = usePlayerStateSelector((state) => state.initialized);
  const paused = usePlayerStateSelector((state) => state.paused);
  const duration = usePlayerStateSelector((state) => state.duration);
  const filename = usePlayerStateSelector((state) => state.filename);
  const selectedAudioTrackId = usePlayerStateSelector((state) => state.selectedAudioTrackId);
  const selectedSubtitleTrackId = usePlayerStateSelector((state) => state.selectedSubtitleTrackId);
  const tracks = usePlayerStateSelector((state) => state.tracks);
  const derivedState = useMemo(
    () =>
      getPlayerTrackDerivedState({
        selectedAudioTrackId,
        selectedSubtitleTrackId,
        tracks,
      }),
    [selectedAudioTrackId, selectedSubtitleTrackId, tracks],
  );

  return {
    initialized,
    paused,
    duration,
    filename,
    hasMedia: hasLoadedMedia({ filename }),
    totalTime: formatTime(duration),
    audioTracks: derivedState.audioTracks,
    subtitleTracks: derivedState.subtitleTracks,
    selectedAudioTrack: derivedState.selectedAudioTrack,
    selectedSubtitleTrack: derivedState.selectedSubtitleTrack,
    audioSummary: derivedState.audioSummary,
    subtitleSummary: derivedState.subtitleSummary,
  };
}

export function useMediaOpenActions({
  player,
  setError,
  withPlayerFocusRestore,
}: {
  player: MpvPlayer;
  setError: SetError;
  withPlayerFocusRestore: <T>(task: () => Promise<T>) => Promise<T>;
}): ReturnType<typeof createMediaOpenActions> {
  const isOpeningPastedWebUrlRef = useRef(false);

  return useMemo(
    () =>
      createMediaOpenActions({
        player,
        setError,
        withPlayerFocusRestore,
        isOpeningPastedWebUrlRef,
      }),
    [player, setError, withPlayerFocusRestore],
  );
}

export function useTrackActions({
  player,
  hasMedia,
  selectedAudioTrack,
  selectedSubtitleTrack,
  audioTracks,
  subtitleTracks,
  setError,
  setToast,
}: {
  player: MpvPlayer;
  hasMedia: boolean;
  selectedAudioTrack: ReturnType<typeof getPlayerTrackDerivedState>["selectedAudioTrack"];
  selectedSubtitleTrack: ReturnType<typeof getPlayerTrackDerivedState>["selectedSubtitleTrack"];
  audioTracks: ReturnType<typeof getPlayerTrackDerivedState>["audioTracks"];
  subtitleTracks: ReturnType<typeof getPlayerTrackDerivedState>["subtitleTracks"];
  setError: SetError;
  setToast: SetToast;
}): {
  isCyclingAudio: boolean;
  isCyclingSubtitles: boolean;
  cycleAudioTrack: () => Promise<void>;
  cycleSubtitleTrack: () => Promise<void>;
  selectAudioTrack: (id: number | "no") => Promise<void>;
  selectSubtitleTrack: (id: number | "no") => Promise<void>;
} {
  const [isCyclingAudio, setIsCyclingAudio] = useState(false);
  const [isCyclingSubtitles, setIsCyclingSubtitles] = useState(false);
  const [pendingTrackToast, setPendingTrackToast] = useState<TrackKind | null>(null);

  usePendingTrackToast({
    pendingTrackToast,
    audioTracks,
    subtitleTracks,
    selectedAudioTrack,
    selectedSubtitleTrack,
    setToast,
    setPendingTrackToast,
  });

  const cycleAudioTrack = useTrackCycleAction({
    cycleTrack: () => player.cycleAudioTrack(),
    errorMessage: "Failed to change audio track",
    isCycling: isCyclingAudio,
    kind: "audio",
    setError,
    setIsCycling: setIsCyclingAudio,
    setPendingTrackToast,
  });
  const cycleSubtitleTrack = useTrackCycleAction({
    cycleTrack: () => player.cycleSubtitleTrack(),
    errorMessage: "Failed to change subtitle track",
    isCycling: isCyclingSubtitles,
    kind: "subtitles",
    setError,
    setIsCycling: setIsCyclingSubtitles,
    setPendingTrackToast,
  });
  const selectAudioTrack = useCallback(
    async (id: number | "no"): Promise<void> => {
      if (!hasMedia || id === "no" || isCyclingAudio || selectedAudioTrack?.id === id) {
        return;
      }

      setIsCyclingAudio(true);
      try {
        await player.setAudioTrack(id);
        setError("");
        setPendingTrackToast("audio");
      } catch (error) {
        setError(getErrorMessage(error, "Failed to change audio track"));
      } finally {
        setIsCyclingAudio(false);
      }
    },
    [hasMedia, isCyclingAudio, player, selectedAudioTrack?.id, setError],
  );
  const selectSubtitleTrack = useCallback(
    async (id: number | "no"): Promise<void> => {
      if (!hasMedia || isCyclingSubtitles) {
        return;
      }
      if (id === "no" && !selectedSubtitleTrack) {
        return;
      }
      if (id !== "no" && selectedSubtitleTrack?.id === id) {
        return;
      }

      setIsCyclingSubtitles(true);
      try {
        await player.setSubtitleTrack(id);
        setError("");
        setPendingTrackToast("subtitles");
      } catch (error) {
        setError(getErrorMessage(error, "Failed to change subtitle track"));
      } finally {
        setIsCyclingSubtitles(false);
      }
    },
    [hasMedia, isCyclingSubtitles, player, selectedSubtitleTrack, selectedSubtitleTrack?.id, setError],
  );

  return {
    isCyclingAudio,
    isCyclingSubtitles,
    cycleAudioTrack,
    cycleSubtitleTrack,
    selectAudioTrack,
    selectSubtitleTrack,
  };
}

export function usePlayerEnhancementActions({
  player,
  hasMedia,
  filename,
  setError,
  setToast,
}: {
  player: MpvPlayer;
  hasMedia: boolean;
  filename: string;
  setError: SetError;
  setToast: SetToast;
}): {
  isFsrEnabled: boolean;
  toggleFsr: () => Promise<void>;
  adjustVolume: (delta: number) => Promise<void>;
  adjustGamma: (delta: number) => Promise<void>;
  increaseGamma: () => Promise<void>;
  decreaseGamma: () => Promise<void>;
} {
  const [fsrPreferenceEnabled, setFsrPreferenceEnabled] = useState<boolean>(() =>
    getPersistedBoolean(FSR_PREFERENCE_STORAGE_KEY),
  );
  const [isFsrEnabled, setIsFsrEnabled] = useState(false);
  const gammaLevelRef = useRef(0);
  const toggleFsr = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }
    await applyFsrAction({
      errorMessage: "Failed to toggle FSR",
      setError,
      setIsFsrEnabled,
      setToast,
      onSuccess: (enabled) => {
        setFsrPreferenceEnabled(enabled);
        persistBoolean(FSR_PREFERENCE_STORAGE_KEY, enabled);
      },
      task: () => player.toggleFsr(),
    });
  }, [hasMedia, player, setError, setToast]);
  const adjustVolume = useCallback(
    (delta: number): Promise<void> => applyVolumeAction({ player, hasMedia, delta, setToast }),
    [hasMedia, player, setToast],
  );
  const adjustGamma = useCallback(
    async (delta: number): Promise<void> => {
      if (!hasMedia || delta === 0) {
        return;
      }

      await player.adjustGamma(delta);
      gammaLevelRef.current += delta;
      setToast(createGammaToast(gammaLevelRef.current));
    },
    [hasMedia, player, setToast],
  );
  const increaseGamma = useCallback((): Promise<void> => adjustGamma(GAMMA_STEP), [adjustGamma]);
  const decreaseGamma = useCallback((): Promise<void> => adjustGamma(-GAMMA_STEP), [adjustGamma]);

  useEffect(() => {
    gammaLevelRef.current = 0;
  }, [filename, hasMedia]);
  useSavedFsrPreferenceSync({
    player,
    hasMedia,
    filename,
    fsrPreferenceEnabled,
    isFsrEnabled,
    setError,
    setIsFsrEnabled,
    setToast,
  });

  return {
    isFsrEnabled,
    toggleFsr,
    adjustVolume,
    adjustGamma,
    increaseGamma,
    decreaseGamma,
  };
}
