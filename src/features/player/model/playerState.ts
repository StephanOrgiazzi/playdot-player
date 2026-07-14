export const DEFAULT_PLAYBACK_SPEED = 1;
export const DEFAULT_PLAYER_VOLUME = 150;

export type MediaTrack = {
  id: number;
  type: "audio" | "sub" | "video";
  title: string;
  lang?: string;
  selected: boolean;
  external: boolean;
  albumart: boolean;
};

export type PlayerState = {
  initialized: boolean;
  paused: boolean;
  pausedForCache: boolean;
  coreIdle: boolean;
  eofReached: boolean;
  timePos: number;
  duration: number;
  volume: number;
  mute: boolean;
  playbackSpeed: number;
  filename: string;
  selectedAudioTrackId: number | null;
  selectedSubtitleTrackId: number | null;
  isAudioArtworkActive: boolean;
  audioArtworkUrl: string;
  tracks: MediaTrack[];
};

export const EMPTY_PLAYER_STATE: PlayerState = {
  initialized: false,
  paused: true,
  pausedForCache: false,
  coreIdle: false,
  eofReached: false,
  timePos: 0,
  duration: 0,
  volume: DEFAULT_PLAYER_VOLUME,
  mute: false,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  filename: "",
  selectedAudioTrackId: null,
  selectedSubtitleTrackId: null,
  isAudioArtworkActive: false,
  audioArtworkUrl: "",
  tracks: [],
};
