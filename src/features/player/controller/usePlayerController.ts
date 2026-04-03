import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createMediaOpenActions } from "@features/mediaOpen/actions";
import type { TitlebarPointerDown } from "@features/playerChrome/types";
import { useBlurActiveControlWhenChromeHidden } from "@features/playerChrome/useBlurActiveControlWhenChromeHidden";
import { useChromeVisibility } from "@features/playerChrome/useChromeVisibility";
import { useCursorVisibility } from "@features/playerChrome/useCursorVisibility";
import { useTitlebarDrag } from "@features/playerChrome/useTitlebarDrag";
import { useGlobalShortcuts } from "@features/shortcuts/useGlobalShortcuts";
import { createFsrToast, createVolumeToast } from "@features/toaster/messages";
import type { ToastState, TrackKind } from "@features/toaster/types";
import { usePendingTrackToast, useToastAutoHide } from "@features/toaster/useToastEffects";
import { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { clampUiVolume, getMpvVolumeFromUiVolume, getUiVolumeFromMpvVolume } from "@integrations/mpv/constants";
import { useSvpIntegration } from "@integrations/svp/useSvpIntegration";
import { getErrorMessage } from "@shared/lib/error";
import { usePlayerActions } from "./usePlayerActions";
import { usePlayerLifecycle } from "./usePlayerLifecycle";
import {
  getPersistedFsrPreference,
  persistFsrPreference,
} from "../model/playerPreferences";
import { getPlayerControllerDerivedState } from "../model/playerDerived";
import type { PlayerScreenProps } from "../model/types";
import { EMPTY_PLAYER_STATE, type PlayerState } from "../model/playerState";

const player = new MpvPlayer();
const appWindow = getCurrentWindow();
const appWebview = getCurrentWebview();
const withPlayerFocusRestore = async <T>(task: () => Promise<T>): Promise<T> => {
  try {
    return await task();
  } finally {
    await Promise.allSettled([appWindow.setFocus(), appWebview.setFocus()]);
  }
};

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
  setError: (value: string) => void;
  setIsFsrEnabled: (value: boolean) => void;
  setToast: (value: ToastState) => void;
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
  hasMedia,
  delta,
  setToast,
}: {
  hasMedia: boolean;
  delta: number;
  setToast: (value: ToastState) => void;
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
  setError: (value: string) => void;
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
  hasMedia,
  filename,
  fsrPreferenceEnabled,
  isFsrEnabled,
  setError,
  setIsFsrEnabled,
  setToast,
}: {
  hasMedia: boolean;
  filename: string;
  fsrPreferenceEnabled: boolean;
  isFsrEnabled: boolean;
  setError: (value: string) => void;
  setIsFsrEnabled: (value: boolean) => void;
  setToast: (value: ToastState) => void;
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
  }, [filename, fsrPreferenceEnabled, hasMedia, isFsrEnabled, setError, setIsFsrEnabled, setToast]);
}

function useControlDockHoverState(): {
  isControlDockHovered: boolean;
  handleControlDockMouseEnter: () => void;
  handleControlDockMouseLeave: () => void;
} {
  const [isControlDockHovered, setIsControlDockHovered] = useState(false);
  const handleControlDockMouseEnter = useCallback((): void => setIsControlDockHovered(true), []);
  const handleControlDockMouseLeave = useCallback((): void => setIsControlDockHovered(false), []);

  return {
    isControlDockHovered,
    handleControlDockMouseEnter,
    handleControlDockMouseLeave,
  };
}

function useTitlebarInteractions({
  isFullscreen,
  pickAndOpenMediaFile,
}: {
  isFullscreen: boolean;
  pickAndOpenMediaFile: () => Promise<void>;
}): {
  handleTitlebarMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  handleTitlePillClick: () => void;
} {
  const titlebarPointerDownRef = useRef<TitlebarPointerDown | null>(null);
  const suppressTitlePillClickRef = useRef(false);

  useTitlebarDrag({
    appWindow,
    titlebarPointerDownRef,
    suppressTitlePillClickRef,
  });

  const handleTitlebarMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>): void => {
      if (event.button !== 0 || isFullscreen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest(".window-controls")) {
        return;
      }

      titlebarPointerDownRef.current = {
        startedOnTitlePill: Boolean(target.closest(".title-pill")),
        x: event.clientX,
        y: event.clientY,
      };
    },
    [isFullscreen],
  );

  const handleTitlePillClick = useCallback((): void => {
    if (suppressTitlePillClickRef.current) {
      suppressTitlePillClickRef.current = false;
      return;
    }

    void pickAndOpenMediaFile();
  }, [pickAndOpenMediaFile]);

  return {
    handleTitlebarMouseDown,
    handleTitlePillClick,
  };
}

function useWindowStateSync(): {
  isFullscreen: boolean;
  syncWindowState: () => Promise<void>;
} {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncWindowState = useCallback(async (): Promise<void> => {
    setIsFullscreen(await appWindow.isFullscreen());
  }, []);

  return {
    isFullscreen,
    syncWindowState,
  };
}

export function usePlayerController(): PlayerScreenProps {
  const [state, setState] = useState<PlayerState>(EMPTY_PLAYER_STATE);
  const [error, setError] = useState("");
  const [fsrPreferenceEnabled, setFsrPreferenceEnabled] = useState<boolean>(getPersistedFsrPreference);
  const [isFsrEnabled, setIsFsrEnabled] = useState(false);
  const [isCyclingAudio, setIsCyclingAudio] = useState(false);
  const [isCyclingSubtitles, setIsCyclingSubtitles] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingTrackToast, setPendingTrackToast] = useState<TrackKind | null>(null);
  const isOpeningPastedWebUrlRef = useRef(false);
  const { isFullscreen, syncWindowState } = useWindowStateSync();
  const {
    isControlDockHovered,
    handleControlDockMouseEnter,
    handleControlDockMouseLeave,
  } = useControlDockHoverState();

  const derivedState = getPlayerControllerDerivedState(state);
  const {
    hasMedia,
    audioTracks,
    subtitleTracks,
    selectedAudioTrack,
    selectedSubtitleTrack,
    currentTime,
    totalTime,
    progressMax,
    progressPercent,
    displayVolume,
    volumePercent,
    audioSummary,
    subtitleSummary,
  } = derivedState;
  const isChromeVisible = useChromeVisibility(hasMedia, isControlDockHovered);
  const isChromeHidden = hasMedia && !isChromeVisible;
  const isCursorHidden = useCursorVisibility(hasMedia, isControlDockHovered);
  const {
    isSvpAvailable,
    isSvpEnabled,
    isSwitchingSvp,
    preparePlayerStart,
    toggleSvp,
  } = useSvpIntegration({ player, setError, setToast });

  usePlayerLifecycle({
    player,
    appWindow,
    setState,
    setError,
    syncWindowState,
    beforeStart: preparePlayerStart,
  });
  useToastAutoHide(toast, setToast);
  useBlurActiveControlWhenChromeHidden(isChromeHidden);
  usePendingTrackToast({
    pendingTrackToast,
    audioTracks,
    subtitleTracks,
    selectedAudioTrack,
    selectedSubtitleTrack,
    setToast,
    setPendingTrackToast,
  });

  const { pickAndOpenMediaFile, openWebUrl, openPastedWebUrl } = useMemo(
    () =>
      createMediaOpenActions({
        player,
        setError,
        withPlayerFocusRestore,
        isOpeningPastedWebUrlRef,
      }),
    [],
  );

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
        persistFsrPreference(enabled);
      },
      task: () => player.toggleFsr(),
    });
  }, [hasMedia]);

  const adjustVolume = useCallback((delta: number): Promise<void> => applyVolumeAction({ hasMedia, delta, setToast }), [hasMedia]);

  useSavedFsrPreferenceSync({
    hasMedia,
    filename: state.filename,
    fsrPreferenceEnabled,
    isFsrEnabled,
    setError,
    setIsFsrEnabled,
    setToast,
  });

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    const next = !(await appWindow.isFullscreen());
    await appWindow.setFullscreen(next);
    await syncWindowState();
  }, [syncWindowState]);

  const { handleTitlebarMouseDown, handleTitlePillClick } = useTitlebarInteractions({
    isFullscreen,
    pickAndOpenMediaFile,
  });

  const {
    handleVideoDoubleClick,
    togglePlayPause,
    seekBack,
    seekForward,
    slowDownPlayback,
    speedUpPlayback,
    toggleMute,
    zoomIn,
    zoomOut,
    increaseSubtitleScale,
    decreaseSubtitleScale,
    setTimelinePosition,
    setVolume,
    minimizeWindow,
    closeWindow,
  } = usePlayerActions({
    appWindow,
    player,
    hasMedia,
    isFullscreen,
    setToast,
    toggleFullscreen,
  });

  useGlobalShortcuts({
    cycleAudioTrack,
    cycleSubtitleTrack,
    closeWindow,
    adjustVolume,
    hasMedia,
    isFullscreen,
    openPastedWebUrl,
    seekBack,
    seekForward,
    slowDownPlayback,
    speedUpPlayback,
    zoomIn,
    zoomOut,
    increaseSubtitleScale,
    decreaseSubtitleScale,
    toggleFsr,
    toggleFullscreen,
    toggleMute,
    togglePlayPause,
  });

  return {
    state,
    error,
    toast,
    isFullscreen,
    isFsrEnabled,
    isSvpAvailable,
    isSvpEnabled,
    isSwitchingSvp,
    isChromeHidden,
    isCursorHidden,
    isCyclingAudio,
    isCyclingSubtitles,
    hasMedia,
    audioTracks,
    subtitleTracks,
    currentTime,
    totalTime,
    progressMax,
    progressPercent,
    displayVolume,
    volumePercent,
    audioSummary,
    subtitleSummary,
    pickAndOpenMediaFile,
    openWebUrl,
    cycleAudioTrack,
    cycleSubtitleTrack,
    toggleFsr,
    toggleSvp,
    toggleFullscreen,
    handleTitlebarMouseDown,
    handleTitlePillClick,
    handleControlDockMouseEnter,
    handleControlDockMouseLeave,
    handleVideoDoubleClick,
    togglePlayPause,
    seekBack,
    seekForward,
    slowDownPlayback,
    speedUpPlayback,
    toggleMute,
    zoomIn,
    zoomOut,
    increaseSubtitleScale,
    decreaseSubtitleScale,
    setTimelinePosition,
    setVolume,
    minimizeWindow,
    closeWindow,
  };
}
