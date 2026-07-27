import type { PlayerState } from "@features/player/model/playerState";
import type { MpvEvent } from "./libmpv-api";

export function preparePlayerStateForMediaLoad(state: PlayerState): PlayerState {
  return {
    ...state,
    paused: true,
    pausedForCache: false,
    coreIdle: false,
    eofReached: false,
    timePos: 0,
    duration: 0,
    filename: "",
    playbackError: "",
    selectedAudioTrackId: null,
    selectedSubtitleTrackId: null,
    tracks: [],
  };
}

export function getMpvPlaybackFailure(
  event: MpvEvent,
  activePlaylistEntryId: number | null,
  mediaLoadPending: boolean,
): string | null {
  if (event.event !== "end-file" || event.reason !== "error") {
    return null;
  }

  if (mediaLoadPending && activePlaylistEntryId === null) {
    return null;
  }

  if (
    activePlaylistEntryId !== null &&
    typeof event.playlist_entry_id === "number" &&
    event.playlist_entry_id !== activePlaylistEntryId
  ) {
    return null;
  }

  const errorCode = typeof event.error === "number" && event.error !== 0 ? ` (mpv error ${event.error})` : "";
  return `Playback failed${errorCode}`;
}
