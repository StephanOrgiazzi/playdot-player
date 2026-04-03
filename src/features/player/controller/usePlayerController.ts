import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { AUTO_HIDE_DELAY_MS } from "@features/playerChrome/constants";
import type { TitlebarPointerDown } from "@features/playerChrome/types";
import { useBlurActiveControlWhenChromeHidden } from "@features/playerChrome/useBlurActiveControlWhenChromeHidden";
import { useAutoHiddenFlag } from "@features/playerChrome/useAutoHiddenFlag";
import { useTitlebarDrag } from "@features/playerChrome/useTitlebarDrag";
import { useGlobalShortcuts } from "@features/shortcuts/useGlobalShortcuts";
import type { ToastState } from "@features/toaster/types";
import { useToastAutoHide } from "@features/toaster/useToastEffects";
import { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { useSvpIntegration } from "@integrations/svp/useSvpIntegration";
import { usePlayerActions } from "./usePlayerActions";
import {
  useMediaOpenActions,
  usePlayerEnhancementActions,
  usePlayerMediaState,
  useTrackActions,
} from "./usePlayerControllerHooks";
import { usePlayerLifecycle } from "./usePlayerLifecycle";
import type { PlayerScreenProps } from "../model/types";

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
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const { isFullscreen, syncWindowState } = useWindowStateSync();
  const {
    isControlDockHovered,
    handleControlDockMouseEnter,
    handleControlDockMouseLeave,
  } = useControlDockHoverState();
  const {
    initialized,
    paused,
    duration,
    filename,
    hasMedia,
    totalTime,
    audioTracks,
    subtitleTracks,
    selectedAudioTrack,
    selectedSubtitleTrack,
    audioSummary,
    subtitleSummary,
  } = usePlayerMediaState();
  const isChromeHidden = useAutoHiddenFlag({
    enabled: hasMedia,
    paused: isControlDockHovered,
    delayMs: AUTO_HIDE_DELAY_MS,
  });
  const isCursorHidden = isChromeHidden;
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
    setError,
    syncWindowState,
    beforeStart: preparePlayerStart,
  });
  useToastAutoHide(toast, setToast);
  useBlurActiveControlWhenChromeHidden(isChromeHidden);

  const { pickAndOpenMediaFile, openWebUrl, openPastedWebUrl } = useMediaOpenActions({
    player,
    setError,
    withPlayerFocusRestore,
  });
  const {
    isCyclingAudio,
    isCyclingSubtitles,
    cycleAudioTrack,
    cycleSubtitleTrack,
    selectAudioTrack,
    selectSubtitleTrack,
  } = useTrackActions({
    player,
    hasMedia,
    selectedAudioTrack,
    selectedSubtitleTrack,
    audioTracks,
    subtitleTracks,
    setError,
    setToast,
  });
  const {
    isFsrEnabled,
    toggleFsr,
    adjustVolume,
    adjustGamma,
    increaseGamma,
    decreaseGamma,
  } = usePlayerEnhancementActions({
    player,
    hasMedia,
    filename,
    setError,
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
    adjustGamma,
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
    initialized,
    paused,
    duration,
    filename,
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
    totalTime,
    audioSummary,
    subtitleSummary,
    pickAndOpenMediaFile,
    openWebUrl,
    cycleAudioTrack,
    cycleSubtitleTrack,
    selectAudioTrack,
    selectSubtitleTrack,
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
    increaseGamma,
    decreaseGamma,
    increaseSubtitleScale,
    decreaseSubtitleScale,
    setTimelinePosition,
    setVolume,
    minimizeWindow,
    closeWindow,
  };
}
