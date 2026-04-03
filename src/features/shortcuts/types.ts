import type { AsyncAction } from "@features/player/model/types";

export type ShortcutActions = {
  cycleAudioTrack: AsyncAction;
  cycleSubtitleTrack: AsyncAction;
  closeWindow: AsyncAction;
  adjustVolume: (delta: number) => Promise<void>;
  zoomIn: AsyncAction;
  zoomOut: AsyncAction;
  increaseSubtitleScale: AsyncAction;
  decreaseSubtitleScale: AsyncAction;
  openPastedWebUrl: (clipboardText: string) => Promise<void>;
  seekBack: AsyncAction;
  seekForward: AsyncAction;
  slowDownPlayback: AsyncAction;
  speedUpPlayback: AsyncAction;
  adjustGamma: (delta: number) => Promise<void>;
  toggleFsr: AsyncAction;
  toggleFullscreen: AsyncAction;
  toggleMute: AsyncAction;
  togglePlayPause: AsyncAction;
};

export type UseGlobalShortcutsOptions = ShortcutActions & {
  hasMedia: boolean;
  isFullscreen: boolean;
};
