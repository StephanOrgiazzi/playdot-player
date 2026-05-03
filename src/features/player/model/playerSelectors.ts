import type { MediaTrack, PlayerState } from "./playerState";

type TrackType = MediaTrack["type"];
type MediaPresenceState = Pick<PlayerState, "filename">;
type TrackListState = Pick<PlayerState, "tracks">;
type TrackSelectionState = TrackListState &
  Pick<PlayerState, "selectedAudioTrackId" | "selectedSubtitleTrackId">;

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
