import type { MouseEvent as ReactMouseEvent } from "react";
import type { OpenWebUrlResult } from "@features/mediaOpen/types";
import type { ToastState } from "@features/toaster/types";
import type { MediaTrack } from "./playerState";

export type PlayerAction = () => void;
export type TrackSelectionAction = (id: number | "no") => void;

export type PlayerScreenProps = {
  initialized: boolean;
  filename: string;
  error: string;
  toast: ToastState | null;
  isFullscreen: boolean;
  isFsrEnabled: boolean;
  isAudioNormalizerEnabled: boolean;
  isStereoDownmixEnabled: boolean;
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isSwitchingSvp: boolean;
  isChromeHidden: boolean;
  isCursorHidden: boolean;
  isCyclingAudio: boolean;
  isCyclingSubtitles: boolean;
  hasMedia: boolean;
  hasVideo: boolean;
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  audioSummary: string;
  subtitleSummary: string;
  isAudioArtworkActive: boolean;
  audioArtworkUrl: string;
  pickAndOpenMediaFile: PlayerAction;
  openWebUrl: (url: string) => Promise<OpenWebUrlResult>;
  cycleAudioTrack: PlayerAction;
  cycleSubtitleTrack: PlayerAction;
  selectAudioTrack: TrackSelectionAction;
  selectSubtitleTrack: TrackSelectionAction;
  toggleFsr: PlayerAction;
  toggleAudioNormalizer: PlayerAction;
  toggleStereoDownmix: PlayerAction;
  toggleSvp: PlayerAction;
  toggleFullscreen: PlayerAction;
  handleTitlebarMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  handleTitlePillClick: () => void;
  handleControlDockMouseEnter: () => void;
  handleControlDockMouseLeave: () => void;
  handleVideoDoubleClick: () => void;
  togglePlayPause: PlayerAction;
  seekBack: PlayerAction;
  seekForward: PlayerAction;
  slowDownPlayback: PlayerAction;
  speedUpPlayback: PlayerAction;
  toggleMute: PlayerAction;
  zoomIn: PlayerAction;
  zoomOut: PlayerAction;
  increaseGamma: PlayerAction;
  decreaseGamma: PlayerAction;
  increaseSubtitleScale: PlayerAction;
  decreaseSubtitleScale: PlayerAction;
  setTimelinePosition: (value: number) => void;
  requestTimelineThumbnail: (value: number) => void;
  clearTimelineThumbnail: () => void;
  subscribeTimelineThumbnail: (listener: (url: string) => void) => () => void;
  setVolume: (value: number) => void;
  minimizeWindow: PlayerAction;
  closeWindow: PlayerAction;
};

export type PlayerControlsProps = Pick<
  PlayerScreenProps,
  | "hasMedia"
  | "isFullscreen"
  | "isChromeHidden"
  | "isCyclingAudio"
  | "isCyclingSubtitles"
  | "audioTracks"
  | "subtitleTracks"
  | "audioSummary"
  | "subtitleSummary"
  | "cycleAudioTrack"
  | "cycleSubtitleTrack"
  | "toggleFullscreen"
  | "handleControlDockMouseEnter"
  | "handleControlDockMouseLeave"
  | "togglePlayPause"
  | "seekBack"
  | "seekForward"
  | "toggleMute"
  | "setTimelinePosition"
  | "requestTimelineThumbnail"
  | "clearTimelineThumbnail"
  | "subscribeTimelineThumbnail"
  | "setVolume"
>;
