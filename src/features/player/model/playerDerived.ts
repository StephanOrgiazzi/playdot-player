import { getSelectedTrackByType, getTracksByType } from "./playerSelectors";
import type { MediaTrack, PlayerState } from "./playerState";

type PlayerTrackState = Pick<
  PlayerState,
  | "selectedAudioTrackId"
  | "selectedSubtitleTrackId"
  | "tracks"
>;

export type PlayerTrackDerivedState = {
  audioTracks: ReturnType<typeof getTracksByType>;
  subtitleTracks: ReturnType<typeof getTracksByType>;
  selectedAudioTrack: ReturnType<typeof getSelectedTrackByType>;
  selectedSubtitleTrack: ReturnType<typeof getSelectedTrackByType>;
  audioSummary: string;
  subtitleSummary: string;
};

function getTrackSummary(
  tracks: MediaTrack[],
  selectedTrack: MediaTrack | undefined,
  fallback: string,
): string {
  if (selectedTrack) {
    return selectedTrack.lang ?? selectedTrack.title;
  }

  return tracks.length > 0 ? `${tracks.length} tracks` : fallback;
}

export function getPlayerTrackDerivedState(
  state: PlayerTrackState,
): PlayerTrackDerivedState {
  const audioTracks = getTracksByType(state, "audio");
  const subtitleTracks = getTracksByType(state, "sub");
  const selectedAudioTrack = getSelectedTrackByType(state, "audio");
  const selectedSubtitleTrack = getSelectedTrackByType(state, "sub");

  return {
    audioTracks,
    subtitleTracks,
    selectedAudioTrack,
    selectedSubtitleTrack,
    audioSummary: getTrackSummary(audioTracks, selectedAudioTrack, "No audio"),
    subtitleSummary: getTrackSummary(subtitleTracks, selectedSubtitleTrack, "Subtitles off"),
  };
}
