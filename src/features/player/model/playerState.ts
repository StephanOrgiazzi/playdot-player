import { DEFAULT_PLAYBACK_SPEED, MPV_VOLUME_DEFAULT } from "@integrations/mpv/constants";
import type { MpvNodeValue } from "@integrations/mpv/libmpv-api";

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
  cacheBufferingState: number;
  demuxerCacheState: MpvNodeValue | null;
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
  cacheBufferingState: 0,
  demuxerCacheState: null,
  eofReached: false,
  timePos: 0,
  duration: 0,
  volume: MPV_VOLUME_DEFAULT,
  mute: false,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  filename: "",
  selectedAudioTrackId: null,
  selectedSubtitleTrackId: null,
  isAudioArtworkActive: false,
  audioArtworkUrl: "",
  tracks: [],
};
