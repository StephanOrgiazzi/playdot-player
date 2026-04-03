import type { MouseEvent as ReactMouseEvent } from "react";
import type { OpenWebUrlResult } from "@features/mediaOpen/types";
import type { ToastState } from "@features/toaster/types";
import type { MediaTrack, PlayerState } from "./playerState";

export type AsyncAction = () => Promise<void>;

export type PlayerScreenProps = {
  state: PlayerState;
  error: string;
  toast: ToastState | null;
  isFullscreen: boolean;
  isFsrEnabled: boolean;
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isSwitchingSvp: boolean;
  isChromeHidden: boolean;
  isCursorHidden: boolean;
  isCyclingAudio: boolean;
  isCyclingSubtitles: boolean;
  hasMedia: boolean;
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  currentTime: string;
  totalTime: string;
  progressMax: number;
  progressPercent: string;
  displayVolume: number;
  volumePercent: string;
  audioSummary: string;
  subtitleSummary: string;
  pickAndOpenMediaFile: AsyncAction;
  openWebUrl: (url: string) => Promise<OpenWebUrlResult>;
  cycleAudioTrack: AsyncAction;
  cycleSubtitleTrack: AsyncAction;
  toggleFsr: AsyncAction;
  toggleSvp: AsyncAction;
  toggleFullscreen: AsyncAction;
  handleTitlebarMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  handleTitlePillClick: () => void;
  handleControlDockMouseEnter: () => void;
  handleControlDockMouseLeave: () => void;
  handleVideoDoubleClick: () => void;
  togglePlayPause: AsyncAction;
  seekBack: AsyncAction;
  seekForward: AsyncAction;
  slowDownPlayback: AsyncAction;
  speedUpPlayback: AsyncAction;
  toggleMute: AsyncAction;
  zoomIn: AsyncAction;
  zoomOut: AsyncAction;
  increaseSubtitleScale: AsyncAction;
  decreaseSubtitleScale: AsyncAction;
  setTimelinePosition: (value: number) => Promise<void>;
  setVolume: (value: number) => Promise<void>;
  minimizeWindow: AsyncAction;
  closeWindow: AsyncAction;
};

export type PlayerControlsProps = Pick<
  PlayerScreenProps,
  | "state"
  | "hasMedia"
  | "isFullscreen"
  | "isChromeHidden"
  | "isCyclingAudio"
  | "isCyclingSubtitles"
  | "audioTracks"
  | "subtitleTracks"
  | "currentTime"
  | "totalTime"
  | "progressMax"
  | "progressPercent"
  | "displayVolume"
  | "volumePercent"
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
  | "setVolume"
>;
