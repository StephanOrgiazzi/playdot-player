import type { MediaTrack, PlayerState } from "./playerState";
import {
  UI_VOLUME_MAX,
  getUiVolumeFromMpvVolume,
} from "@integrations/mpv/constants";

type TrackType = MediaTrack["type"];

export function hasMedia(state: PlayerState): boolean {
  return state.filename.length > 0;
}

export function getTracksByType(state: PlayerState, type: TrackType): MediaTrack[] {
  return state.tracks.filter((track) => track.type === type);
}

export function getSelectedTrackByType(
  state: PlayerState,
  type: TrackType,
): MediaTrack | undefined {
  const selectedId = type === "audio" ? state.selectedAudioTrackId : state.selectedSubtitleTrackId;
  return getTracksByType(state, type).find((track) => track.id === selectedId);
}

export function getProgressMax(state: PlayerState): number {
  return state.duration > 0 ? state.duration : 1;
}

export function getProgressPercent(state: PlayerState): string {
  const progressMax = getProgressMax(state);
  return state.duration > 0
    ? `${(Math.min(state.timePos, progressMax) / progressMax) * 100}%`
    : "0%";
}

export function getVolumePercent(state: PlayerState): string {
  return `${(getUiVolumeFromMpvVolume(state.volume) / UI_VOLUME_MAX) * 100}%`;
}

export function getDisplayedVolume(state: PlayerState): number {
  return getUiVolumeFromMpvVolume(state.volume);
}
