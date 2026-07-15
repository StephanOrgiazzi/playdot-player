import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createMediaOpenActions } from "@features/mediaOpen/actions";
import {
  createFsrToast,
  createGammaToast,
  createStereoDownmixToast,
  createVolumeToast,
} from "@features/toaster/messages";
import type { ToastState, TrackKind } from "@features/toaster/types";
import { usePendingTrackToast } from "@features/toaster/useToastEffects";
import {
  clampUiVolume,
  getMpvVolumeFromUiVolume,
  getUiVolumeFromMpvVolume,
} from "@integrations/mpv/constants";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getPersistedBoolean, persistBoolean } from "@shared/lib/persistedBoolean";
import { getPlayerTrackDerivedState } from "../model/playerDerived";
import { hasMedia as hasLoadedMedia } from "../model/playerSelectors";
import { usePlayerStateSelector } from "./playerSession";
import { useAudioNormalizer } from "./useAudioNormalizer";
import { playerCommand, runPlayerCommand } from "./playerCommand";

const FSR_PREFERENCE_STORAGE_KEY = "playdot-player.player.fsr-enabled";
const STEREO_DOWNMIX_PREFERENCE_STORAGE_KEY = "playdot-player.player.stereo-downmix-enabled";
const GAMMA_STEP = 1;

type SetError = (value: string) => void;
type SetToast = Dispatch<SetStateAction<ToastState | null>>;

async function applyFsrAction({
  setIsFsrEnabled,
  setToast,
  showToast = true,
  onSuccess,
  task,
}: {
  setIsFsrEnabled: (value: boolean) => void;
  setToast: SetToast;
  showToast?: boolean;
  onSuccess?: (enabled: boolean) => void;
  task: () => Promise<boolean>;
}): Promise<void> {
  const enabled = await task();
  setIsFsrEnabled(enabled);
  if (showToast) {
    setToast(createFsrToast(enabled));
  }
  onSuccess?.(enabled);
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
}): () => void {
  return useCallback((): void => {
    if (isCycling) {
      return;
    }

    setIsCycling(true);
    runPlayerCommand(
      playerCommand(errorMessage, async () => {
        try {
          await cycleTrack();
          setError("");
          setPendingTrackToast(kind);
        } finally {
          setIsCycling(false);
        }
      }),
      setError,
    );
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
    runPlayerCommand(
      playerCommand("Failed to apply saved FSR setting", () =>
        applyFsrAction({
          setIsFsrEnabled,
          setToast,
          showToast: false,
          task: () => player.toggleFsr(),
        }),
      ),
      setError,
    );
  }, [
    filename,
    fsrPreferenceEnabled,
    hasMedia,
    isFsrEnabled,
    player,
    setError,
    setIsFsrEnabled,
    setToast,
  ]);
}

export function usePlayerMediaState(): {
  initialized: boolean;
  filename: string;
  hasMedia: boolean;
  hasVideo: boolean;
  audioTracks: ReturnType<typeof getPlayerTrackDerivedState>["audioTracks"];
  subtitleTracks: ReturnType<typeof getPlayerTrackDerivedState>["subtitleTracks"];
  selectedAudioTrack: ReturnType<typeof getPlayerTrackDerivedState>["selectedAudioTrack"];
  selectedSubtitleTrack: ReturnType<typeof getPlayerTrackDerivedState>["selectedSubtitleTrack"];
  audioSummary: string;
  subtitleSummary: string;
  isAudioArtworkActive: boolean;
  audioArtworkUrl: string;
} {
  const initialized = usePlayerStateSelector((state) => state.initialized);
  const filename = usePlayerStateSelector((state) => state.filename);
  const selectedAudioTrackId = usePlayerStateSelector((state) => state.selectedAudioTrackId);
  const selectedSubtitleTrackId = usePlayerStateSelector((state) => state.selectedSubtitleTrackId);
  const isAudioArtworkActive = usePlayerStateSelector((state) => state.isAudioArtworkActive);
  const audioArtworkUrl = usePlayerStateSelector((state) => state.audioArtworkUrl);
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
    filename,
    hasMedia: hasLoadedMedia({ filename }),
    hasVideo: tracks.some((track) => track.type === "video" && !track.albumart),
    audioTracks: derivedState.audioTracks,
    subtitleTracks: derivedState.subtitleTracks,
    selectedAudioTrack: derivedState.selectedAudioTrack,
    selectedSubtitleTrack: derivedState.selectedSubtitleTrack,
    audioSummary: derivedState.audioSummary,
    subtitleSummary: derivedState.subtitleSummary,
    isAudioArtworkActive,
    audioArtworkUrl,
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
  cycleAudioTrack: () => void;
  cycleSubtitleTrack: () => void;
  selectAudioTrack: (id: number | "no") => void;
  selectSubtitleTrack: (id: number | "no") => void;
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
    (id: number | "no"): void => {
      if (!hasMedia || id === "no" || isCyclingAudio || selectedAudioTrack?.id === id) {
        return;
      }

      setIsCyclingAudio(true);
      runPlayerCommand(
        playerCommand("Failed to change audio track", async () => {
          try {
            await player.setAudioTrack(id);
            setError("");
            setPendingTrackToast("audio");
          } finally {
            setIsCyclingAudio(false);
          }
        }),
        setError,
      );
    },
    [hasMedia, isCyclingAudio, player, selectedAudioTrack?.id, setError],
  );
  const selectSubtitleTrack = useCallback(
    (id: number | "no"): void => {
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
      runPlayerCommand(
        playerCommand("Failed to change subtitle track", async () => {
          try {
            await player.setSubtitleTrack(id);
            setError("");
            setPendingTrackToast("subtitles");
          } finally {
            setIsCyclingSubtitles(false);
          }
        }),
        setError,
      );
    },
    [
      hasMedia,
      isCyclingSubtitles,
      player,
      selectedSubtitleTrack,
      selectedSubtitleTrack?.id,
      setError,
    ],
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
  isAudioNormalizerEnabled: boolean;
  isStereoDownmixEnabled: boolean;
  toggleFsr: () => void;
  toggleAudioNormalizer: () => void;
  toggleStereoDownmix: () => void;
  preparePlayerStart: () => Promise<void>;
  adjustVolume: (delta: number) => void;
  adjustGamma: (delta: number) => void;
  increaseGamma: () => void;
  decreaseGamma: () => void;
} {
  const { isAudioNormalizerEnabled, toggleAudioNormalizer } = useAudioNormalizer({
    player,
    hasMedia,
    setError,
    setToast,
  });
  const [fsrPreferenceEnabled, setFsrPreferenceEnabled] = useState<boolean>(() =>
    getPersistedBoolean(FSR_PREFERENCE_STORAGE_KEY),
  );
  const [stereoDownmixPreferenceEnabled, setStereoDownmixPreferenceEnabled] = useState<boolean>(
    () => getPersistedBoolean(STEREO_DOWNMIX_PREFERENCE_STORAGE_KEY, false),
  );
  const [isFsrEnabled, setIsFsrEnabled] = useState(false);
  const [isStereoDownmixEnabled, setIsStereoDownmixEnabled] = useState(
    stereoDownmixPreferenceEnabled,
  );
  const gammaLevelRef = useRef(0);
  const isSwitchingStereoDownmixRef = useRef(false);
  const preparePlayerStart = useCallback(async (): Promise<void> => {
    await player.setStereoDownmixEnabled(stereoDownmixPreferenceEnabled);
    setIsStereoDownmixEnabled(stereoDownmixPreferenceEnabled);
  }, [player, stereoDownmixPreferenceEnabled]);
  const toggleFsr = useCallback((): void => {
    if (!hasMedia) {
      return;
    }
    runPlayerCommand(
      playerCommand("Failed to toggle FSR", () =>
        applyFsrAction({
          setIsFsrEnabled,
          setToast,
          onSuccess: (enabled) => {
            setError("");
            setFsrPreferenceEnabled(enabled);
            persistBoolean(FSR_PREFERENCE_STORAGE_KEY, enabled);
          },
          task: () => player.toggleFsr(),
        }),
      ),
      setError,
    );
  }, [hasMedia, player, setError, setToast]);
  const adjustVolume = useCallback(
    (delta: number): void => {
      runPlayerCommand(
        playerCommand("Failed to adjust volume", () =>
          applyVolumeAction({ player, hasMedia, delta, setToast }),
        ),
        setError,
      );
    },
    [hasMedia, player, setError, setToast],
  );
  const toggleStereoDownmix = useCallback((): void => {
    if (!hasMedia || isSwitchingStereoDownmixRef.current) {
      return;
    }

    isSwitchingStereoDownmixRef.current = true;
    runPlayerCommand(
      playerCommand("Failed to toggle stereo downmix", async () => {
        try {
          const nextPreferenceEnabled = !stereoDownmixPreferenceEnabled;
          await player.setStereoDownmixEnabled(nextPreferenceEnabled);
          setError("");
          setStereoDownmixPreferenceEnabled(nextPreferenceEnabled);
          setIsStereoDownmixEnabled(nextPreferenceEnabled);
          persistBoolean(STEREO_DOWNMIX_PREFERENCE_STORAGE_KEY, nextPreferenceEnabled);
          setToast(createStereoDownmixToast(nextPreferenceEnabled));
        } finally {
          isSwitchingStereoDownmixRef.current = false;
        }
      }),
      setError,
    );
  }, [hasMedia, player, setError, setToast, stereoDownmixPreferenceEnabled]);
  const adjustGamma = useCallback(
    (delta: number): void => {
      if (!hasMedia || delta === 0) {
        return;
      }

      runPlayerCommand(
        playerCommand("Failed to adjust gamma", async () => {
          await player.adjustGamma(delta);
          gammaLevelRef.current += delta;
          setToast(createGammaToast(gammaLevelRef.current));
        }),
        setError,
      );
    },
    [hasMedia, player, setError, setToast],
  );
  const increaseGamma = useCallback((): void => {
    adjustGamma(GAMMA_STEP);
  }, [adjustGamma]);
  const decreaseGamma = useCallback((): void => {
    adjustGamma(-GAMMA_STEP);
  }, [adjustGamma]);

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
    isAudioNormalizerEnabled,
    isStereoDownmixEnabled,
    preparePlayerStart,
    toggleFsr,
    toggleAudioNormalizer,
    toggleStereoDownmix,
    adjustVolume,
    adjustGamma,
    increaseGamma,
    decreaseGamma,
  };
}
