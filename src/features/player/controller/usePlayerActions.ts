import { useCallback, useEffect, useRef } from "react";
import type { Window } from "@tauri-apps/api/window";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getMpvVolumeFromUiVolume } from "@integrations/mpv/constants";
import {
  createMuteToast,
  createPlaybackSpeedToast,
  createSubtitleScaleToast,
  createZoomToast,
} from "@features/toaster/messages";
import type { ToastState } from "@features/toaster/types";
import type { PlayerScreenProps } from "../model/types";
import { playerCommand, runPlayerCommand, useLatestPlayerCommand } from "./playerCommand";

const SEEK_STEP_SECONDS = 5;
const PLAYBACK_SPEED_STEP_FACTOR = 1.1;
const VIDEO_ZOOM_STEP = 0.1;
const SUBTITLE_SCALE_STEP = 0.1;

type UsePlayerActionsArgs = {
  appWindow: Window;
  player: MpvPlayer;
  hasMedia: boolean;
  isFullscreen: boolean;
  setToast: (value: ToastState) => void;
  setError: (message: string) => void;
  toggleFullscreen: () => void;
};

type PlayerActions = Pick<
  PlayerScreenProps,
  | "handleVideoDoubleClick"
  | "togglePlayPause"
  | "seekBack"
  | "seekForward"
  | "slowDownPlayback"
  | "speedUpPlayback"
  | "toggleMute"
  | "zoomIn"
  | "zoomOut"
  | "increaseSubtitleScale"
  | "decreaseSubtitleScale"
  | "setTimelinePosition"
  | "setVolume"
  | "minimizeWindow"
  | "closeWindow"
>;

export function usePlayerActions({
  appWindow,
  player,
  hasMedia,
  isFullscreen,
  setToast,
  setError,
  toggleFullscreen,
}: UsePlayerActionsArgs): PlayerActions {
  const estimatedVideoZoomRef = useRef(0);
  const estimatedSubtitleScaleRef = useRef(1);
  const { runLatest: runLatestSeek } = useLatestPlayerCommand(setError);
  const { runLatest: runLatestVolume } = useLatestPlayerCommand(setError);
  const execute = useCallback(
    (fallbackMessage: string, task: () => Promise<void>): void => {
      runPlayerCommand(playerCommand(fallbackMessage, task), setError);
    },
    [setError],
  );

  useEffect(() => {
    if (hasMedia) {
      return;
    }

    estimatedVideoZoomRef.current = 0;
    estimatedSubtitleScaleRef.current = 1;
  }, [hasMedia]);

  const handleVideoDoubleClick = useCallback((): void => {
    if (!hasMedia && !isFullscreen) {
      return;
    }

    toggleFullscreen();
  }, [hasMedia, isFullscreen, toggleFullscreen]);
  const togglePlayPause = useCallback((): void => {
    if (hasMedia) execute("Failed to toggle playback", () => player.togglePlayPause());
  }, [execute, hasMedia, player]);
  const seekBack = useCallback((): void => {
    if (hasMedia) execute("Failed to seek backward", () => player.seekRelative(-SEEK_STEP_SECONDS));
  }, [execute, hasMedia, player]);
  const seekForward = useCallback((): void => {
    if (hasMedia) execute("Failed to seek forward", () => player.seekRelative(SEEK_STEP_SECONDS));
  }, [execute, hasMedia, player]);
  const slowDownPlayback = useCallback((): void => {
    if (!hasMedia) return;
    execute("Failed to slow down playback", async () => {
      const nextSpeed = await player.adjustPlaybackSpeed(1 / PLAYBACK_SPEED_STEP_FACTOR);
      setToast(createPlaybackSpeedToast(nextSpeed));
    });
  }, [execute, hasMedia, player, setToast]);
  const speedUpPlayback = useCallback((): void => {
    if (!hasMedia) return;
    execute("Failed to speed up playback", async () => {
      const nextSpeed = await player.adjustPlaybackSpeed(PLAYBACK_SPEED_STEP_FACTOR);
      setToast(createPlaybackSpeedToast(nextSpeed));
    });
  }, [execute, hasMedia, player, setToast]);
  const toggleMute = useCallback((): void => {
    execute("Failed to toggle mute", async () => {
      const nextMuted = !player.getIsMuted();
      await player.toggleMute();
      setToast(createMuteToast(nextMuted));
    });
  }, [execute, player, setToast]);
  const zoomIn = useCallback((): void => {
    if (!hasMedia) return;
    execute("Failed to zoom video", async () => {
      await player.adjustVideoZoom(VIDEO_ZOOM_STEP);
      estimatedVideoZoomRef.current += VIDEO_ZOOM_STEP;
      setToast(createZoomToast("in", estimatedVideoZoomRef.current));
    });
  }, [execute, hasMedia, player, setToast]);
  const zoomOut = useCallback((): void => {
    if (!hasMedia) return;
    execute("Failed to zoom video", async () => {
      await player.adjustVideoZoom(-VIDEO_ZOOM_STEP);
      estimatedVideoZoomRef.current -= VIDEO_ZOOM_STEP;
      setToast(createZoomToast("out", estimatedVideoZoomRef.current));
    });
  }, [execute, hasMedia, player, setToast]);
  const increaseSubtitleScale = useCallback((): void => {
    if (!hasMedia) return;
    execute("Failed to increase subtitle size", async () => {
      await player.adjustSubtitleScale(SUBTITLE_SCALE_STEP);
      estimatedSubtitleScaleRef.current += SUBTITLE_SCALE_STEP;
      setToast(createSubtitleScaleToast("increase", estimatedSubtitleScaleRef.current));
    });
  }, [execute, hasMedia, player, setToast]);
  const decreaseSubtitleScale = useCallback((): void => {
    if (!hasMedia) return;
    execute("Failed to decrease subtitle size", async () => {
      await player.adjustSubtitleScale(-SUBTITLE_SCALE_STEP);
      estimatedSubtitleScaleRef.current = Math.max(
        SUBTITLE_SCALE_STEP,
        estimatedSubtitleScaleRef.current - SUBTITLE_SCALE_STEP,
      );
      setToast(createSubtitleScaleToast("decrease", estimatedSubtitleScaleRef.current));
    });
  }, [execute, hasMedia, player, setToast]);
  const setTimelinePosition = useCallback(
    (value: number): void => {
      if (hasMedia) {
        runLatestSeek(playerCommand("Failed to seek", () => player.seekAbsolute(value)));
      }
    },
    [hasMedia, player, runLatestSeek],
  );
  const setVolume = useCallback(
    (value: number): void => {
      runLatestVolume(
        playerCommand("Failed to set volume", () =>
          player.setVolume(getMpvVolumeFromUiVolume(value)),
        ),
      );
    },
    [player, runLatestVolume],
  );
  const minimizeWindow = useCallback((): void => {
    execute("Failed to minimize window", () => appWindow.minimize());
  }, [appWindow, execute]);
  const closeWindow = useCallback((): void => {
    execute("Failed to close window", () => appWindow.close());
  }, [appWindow, execute]);

  return {
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
