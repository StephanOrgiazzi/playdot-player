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
  toggleFullscreen: () => Promise<void>;
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
  toggleFullscreen,
}: UsePlayerActionsArgs): PlayerActions {
  const estimatedVideoZoomRef = useRef(0);
  const estimatedSubtitleScaleRef = useRef(1);

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

    void toggleFullscreen();
  }, [hasMedia, isFullscreen, toggleFullscreen]);
  const togglePlayPause = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    await player.togglePlayPause();
  }, [hasMedia, player]);
  const seekBack = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    await player.seekRelative(-SEEK_STEP_SECONDS);
  }, [hasMedia, player]);
  const seekForward = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    await player.seekRelative(SEEK_STEP_SECONDS);
  }, [hasMedia, player]);
  const slowDownPlayback = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    const nextSpeed = await player.adjustPlaybackSpeed(1 / PLAYBACK_SPEED_STEP_FACTOR);
    setToast(createPlaybackSpeedToast("decrease", nextSpeed));
  }, [hasMedia, player, setToast]);
  const speedUpPlayback = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    const nextSpeed = await player.adjustPlaybackSpeed(PLAYBACK_SPEED_STEP_FACTOR);
    setToast(createPlaybackSpeedToast("increase", nextSpeed));
  }, [hasMedia, player, setToast]);
  const toggleMute = useCallback(async (): Promise<void> => {
    const nextMuted = !player.getIsMuted();
    await player.toggleMute();
    setToast(createMuteToast(nextMuted));
  }, [player, setToast]);
  const zoomIn = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    await player.adjustVideoZoom(VIDEO_ZOOM_STEP);
    estimatedVideoZoomRef.current += VIDEO_ZOOM_STEP;
    setToast(createZoomToast("in", estimatedVideoZoomRef.current));
  }, [hasMedia, player, setToast]);
  const zoomOut = useCallback(async (): Promise<void> => {
    if (!hasMedia) {
      return;
    }

    await player.adjustVideoZoom(-VIDEO_ZOOM_STEP);
    estimatedVideoZoomRef.current -= VIDEO_ZOOM_STEP;
    setToast(createZoomToast("out", estimatedVideoZoomRef.current));
  }, [hasMedia, player, setToast]);
  const increaseSubtitleScale = useCallback(
    async (): Promise<void> => {
      if (!hasMedia) {
        return;
      }

      await player.adjustSubtitleScale(SUBTITLE_SCALE_STEP);
      estimatedSubtitleScaleRef.current += SUBTITLE_SCALE_STEP;
      setToast(createSubtitleScaleToast("increase", estimatedSubtitleScaleRef.current));
    },
    [hasMedia, player, setToast],
  );
  const decreaseSubtitleScale = useCallback(
    async (): Promise<void> => {
      if (!hasMedia) {
        return;
      }

      await player.adjustSubtitleScale(-SUBTITLE_SCALE_STEP);
      estimatedSubtitleScaleRef.current = Math.max(
        SUBTITLE_SCALE_STEP,
        estimatedSubtitleScaleRef.current - SUBTITLE_SCALE_STEP,
      );
      setToast(createSubtitleScaleToast("decrease", estimatedSubtitleScaleRef.current));
    },
    [hasMedia, player, setToast],
  );
  const setTimelinePosition = useCallback(
    async (value: number): Promise<void> => {
      if (!hasMedia) {
        return;
      }

      await player.seekAbsolute(value);
    },
    [hasMedia, player],
  );
  const setVolume = useCallback(
    async (value: number): Promise<void> => {
      await player.setVolume(getMpvVolumeFromUiVolume(value));
    },
    [player],
  );
  const minimizeWindow = useCallback((): Promise<void> => appWindow.minimize(), [appWindow]);
  const closeWindow = useCallback((): Promise<void> => appWindow.close(), [appWindow]);

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
