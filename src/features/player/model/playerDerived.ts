import { formatTime } from "@shared/lib/format";
import {
  getDisplayedVolume,
  getProgressMax,
  getProgressPercent,
  getSelectedTrackByType,
  getTracksByType,
  getVolumePercent,
  hasMedia as hasLoadedMedia,
} from "./playerSelectors";
import type { MediaTrack, PlayerState } from "./playerState";

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

export type PlayerControllerDerivedState = {
  hasMedia: boolean;
  audioTracks: ReturnType<typeof getTracksByType>;
  subtitleTracks: ReturnType<typeof getTracksByType>;
  selectedAudioTrack: ReturnType<typeof getSelectedTrackByType>;
  selectedSubtitleTrack: ReturnType<typeof getSelectedTrackByType>;
  currentTime: string;
  totalTime: string;
  progressMax: number;
  progressPercent: string;
  displayVolume: number;
  volumePercent: string;
  audioSummary: string;
  subtitleSummary: string;
};

export function getPlayerControllerDerivedState(state: PlayerState): PlayerControllerDerivedState {
  const hasMedia = hasLoadedMedia(state);
  const audioTracks = getTracksByType(state, "audio");
  const subtitleTracks = getTracksByType(state, "sub");
  const selectedAudioTrack = getSelectedTrackByType(state, "audio");
  const selectedSubtitleTrack = getSelectedTrackByType(state, "sub");

  return {
    hasMedia,
    audioTracks,
    subtitleTracks,
    selectedAudioTrack,
    selectedSubtitleTrack,
    currentTime: formatTime(state.timePos),
    totalTime: formatTime(state.duration),
    progressMax: getProgressMax(state),
    progressPercent: getProgressPercent(state),
    displayVolume: getDisplayedVolume(state),
    volumePercent: getVolumePercent(state),
    audioSummary: getTrackSummary(audioTracks, selectedAudioTrack, "No audio"),
    subtitleSummary: getTrackSummary(subtitleTracks, selectedSubtitleTrack, "Subtitles off"),
  };
}
