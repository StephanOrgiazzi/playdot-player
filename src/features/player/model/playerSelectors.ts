import type { MediaTrack, PlayerState } from "./playerState";
import {
  UI_VOLUME_MAX,
  getUiVolumeFromMpvVolume,
} from "@integrations/mpv/constants";

type TrackType = MediaTrack["type"];
type MediaPresenceState = Pick<PlayerState, "filename">;
type TrackListState = Pick<PlayerState, "tracks">;
type TrackSelectionState = TrackListState &
  Pick<PlayerState, "selectedAudioTrackId" | "selectedSubtitleTrackId">;
type TimelineState = Pick<PlayerState, "duration" | "timePos">;
type VolumeState = Pick<PlayerState, "volume">;

export function hasMedia(state: MediaPresenceState): boolean {
  return state.filename.length > 0;
}

export function getTracksByType(state: TrackListState, type: TrackType): MediaTrack[] {
  return state.tracks.filter((track) => track.type === type);
}

export function getSelectedTrackByType(
  state: TrackSelectionState,
  type: TrackType,
): MediaTrack | undefined {
  const selectedId = type === "audio" ? state.selectedAudioTrackId : state.selectedSubtitleTrackId;
  return getTracksByType(state, type).find((track) => track.id === selectedId);
}

export function getProgressMax(state: TimelineState): number {
  return state.duration > 0 ? state.duration : 1;
}

export function getProgressPercent(state: TimelineState): string {
  const progressMax = getProgressMax(state);
  return state.duration > 0
    ? `${(Math.min(state.timePos, progressMax) / progressMax) * 100}%`
    : "0%";
}

export function getVolumePercent(state: VolumeState): string {
  return `${(getUiVolumeFromMpvVolume(state.volume) / UI_VOLUME_MAX) * 100}%`;
}

export function getDisplayedVolume(state: VolumeState): number {
  return getUiVolumeFromMpvVolume(state.volume);
}
