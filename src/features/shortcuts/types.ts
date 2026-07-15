import type { PlayerAction } from "@features/player/model/types";

export type ShortcutActions = {
  cycleAudioTrack: PlayerAction;
  cycleSubtitleTrack: PlayerAction;
  closeWindow: PlayerAction;
  adjustVolume: (delta: number) => void;
  zoomIn: PlayerAction;
  zoomOut: PlayerAction;
  increaseSubtitleScale: PlayerAction;
  decreaseSubtitleScale: PlayerAction;
  openPastedWebUrl: (clipboardText: string) => void;
  seekBack: PlayerAction;
  seekForward: PlayerAction;
  slowDownPlayback: PlayerAction;
  speedUpPlayback: PlayerAction;
  adjustGamma: (delta: number) => void;
  toggleFsr: PlayerAction;
  toggleAudioNormalizer: PlayerAction;
  toggleStereoDownmix: PlayerAction;
  toggleFullscreen: PlayerAction;
  toggleMute: PlayerAction;
  togglePlayPause: PlayerAction;
};

export type UseGlobalShortcutsOptions = ShortcutActions & {
  hasMedia: boolean;
  isFullscreen: boolean;
};
