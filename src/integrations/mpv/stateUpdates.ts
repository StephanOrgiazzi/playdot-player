import type { PlayerState } from "@features/player/model/playerState";
import type { MpvObservedPropertyEvent } from "./libmpv-api";
import { parseTracks } from "./tracks";

function tracksAreEqual(currentTracks: PlayerState["tracks"], nextTracks: PlayerState["tracks"]): boolean {
  if (currentTracks === nextTracks) {
    return true;
  }

  if (currentTracks.length !== nextTracks.length) {
    return false;
  }

  return currentTracks.every((track, index) => {
    const nextTrack = nextTracks[index];
    return (
      track.id === nextTrack.id &&
      track.type === nextTrack.type &&
      track.title === nextTrack.title &&
      track.lang === nextTrack.lang &&
      track.selected === nextTrack.selected &&
      track.external === nextTrack.external
    );
  });
}

export function applyObservedProperty(state: PlayerState, event: MpvObservedPropertyEvent): PlayerState {
  switch (event.name) {
    case "pause": {
      const paused = Boolean(event.data);
      return paused === state.paused ? state : { ...state, paused };
    }
    case "time-pos": {
      const timePos = typeof event.data === "number" ? event.data : 0;
      return timePos === state.timePos ? state : { ...state, timePos };
    }
    case "duration": {
      const duration = typeof event.data === "number" ? event.data : 0;
      return duration === state.duration ? state : { ...state, duration };
    }
    case "volume": {
      const volume = typeof event.data === "number" ? event.data : state.volume;
      return volume === state.volume ? state : { ...state, volume };
    }
    case "mute": {
      const mute = Boolean(event.data);
      return mute === state.mute ? state : { ...state, mute };
    }
    case "speed": {
      const playbackSpeed =
        typeof event.data === "number" ? event.data : state.playbackSpeed;
      return playbackSpeed === state.playbackSpeed ? state : { ...state, playbackSpeed };
    }
    case "filename": {
      const filename = typeof event.data === "string" ? event.data : "";
      return filename === state.filename ? state : { ...state, filename };
    }
    case "aid": {
      const selectedAudioTrackId = typeof event.data === "number" ? event.data : null;
      return selectedAudioTrackId === state.selectedAudioTrackId
        ? state
        : { ...state, selectedAudioTrackId };
    }
    case "sid": {
      const selectedSubtitleTrackId = typeof event.data === "number" ? event.data : null;
      return selectedSubtitleTrackId === state.selectedSubtitleTrackId
        ? state
        : { ...state, selectedSubtitleTrackId };
    }
    case "track-list": {
      const tracks = parseTracks(event.data);
      return tracksAreEqual(state.tracks, tracks) ? state : { ...state, tracks };
    }
    default:
      return state;
  }
}
