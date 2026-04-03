import { DEFAULT_PLAYBACK_SPEED, MPV_VOLUME_DEFAULT } from "@integrations/mpv/constants";

export type MediaTrack = {
  id: number;
  type: "audio" | "sub";
  title: string;
  lang?: string;
  selected: boolean;
  external: boolean;
};

export type PlayerState = {
  initialized: boolean;
  paused: boolean;
  timePos: number;
  duration: number;
  volume: number;
  mute: boolean;
  playbackSpeed: number;
  filename: string;
  selectedAudioTrackId: number | null;
  selectedSubtitleTrackId: number | null;
  tracks: MediaTrack[];
};

export const EMPTY_PLAYER_STATE: PlayerState = {
  initialized: false,
  paused: true,
  timePos: 0,
  duration: 0,
  volume: MPV_VOLUME_DEFAULT,
  mute: false,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  filename: "",
  selectedAudioTrackId: null,
  selectedSubtitleTrackId: null,
  tracks: [],
};
