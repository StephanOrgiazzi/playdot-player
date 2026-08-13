import { Schema } from "effect";
import type { PlayerState } from "@features/player/model/playerState";
import type { MpvNodeValue, MpvObservedPropertyEvent } from "./libmpv-api";
import { parseTracks } from "./tracks";

function tracksAreEqual(
  currentTracks: PlayerState["tracks"],
  nextTracks: PlayerState["tracks"],
): boolean {
  if (currentTracks === nextTracks) {
    return true;
  }

  if (currentTracks.length !== nextTracks.length) {
    return false;
  }

  return currentTracks.every((track, index) => {
    const nextTrack = nextTracks[index];
    if (!nextTrack) {
      return false;
    }

    return (
      track.id === nextTrack.id &&
      track.type === nextTrack.type &&
      track.title === nextTrack.title &&
      track.lang === nextTrack.lang &&
      track.selected === nextTrack.selected &&
      track.external === nextTrack.external &&
      track.albumart === nextTrack.albumart
    );
  });
}

const isMpvNumber = Schema.is(Schema.Number);
const isMpvBoolean = Schema.is(Schema.Boolean);
const isMpvString = Schema.is(Schema.String);

function getNumberOrZero(value: MpvNodeValue | undefined): number {
  return isMpvNumber(value) ? value : 0;
}

export function applyObservedProperty(
  state: PlayerState,
  event: MpvObservedPropertyEvent,
): PlayerState {
  switch (event.name) {
    case "pause": {
      const paused = isMpvBoolean(event.data) ? event.data : false;
      return paused === state.paused ? state : { ...state, paused };
    }
    case "paused-for-cache": {
      const pausedForCache = isMpvBoolean(event.data) ? event.data : false;
      return pausedForCache === state.pausedForCache ? state : { ...state, pausedForCache };
    }
    case "core-idle": {
      const coreIdle = isMpvBoolean(event.data) ? event.data : false;
      return coreIdle === state.coreIdle ? state : { ...state, coreIdle };
    }
    case "eof-reached": {
      const eofReached = isMpvBoolean(event.data) ? event.data : false;
      return eofReached === state.eofReached ? state : { ...state, eofReached };
    }
    case "time-pos": {
      const timePos = getNumberOrZero(event.data);
      return timePos === state.timePos ? state : { ...state, timePos };
    }
    case "duration": {
      const duration = getNumberOrZero(event.data);
      return duration === state.duration ? state : { ...state, duration };
    }
    case "volume": {
      const volume = isMpvNumber(event.data) ? event.data : state.volume;
      return volume === state.volume ? state : { ...state, volume };
    }
    case "mute": {
      const mute = isMpvBoolean(event.data) ? event.data : state.mute;
      return mute === state.mute ? state : { ...state, mute };
    }
    case "speed": {
      const playbackSpeed = isMpvNumber(event.data) ? event.data : state.playbackSpeed;
      return playbackSpeed === state.playbackSpeed ? state : { ...state, playbackSpeed };
    }
    case "filename": {
      const filename = isMpvString(event.data) ? event.data : "";
      return filename === state.filename ? state : { ...state, filename };
    }
    case "aid": {
      const selectedAudioTrackId = isMpvNumber(event.data) ? event.data : null;
      return selectedAudioTrackId === state.selectedAudioTrackId
        ? state
        : { ...state, selectedAudioTrackId };
    }
    case "sid": {
      const selectedSubtitleTrackId = isMpvNumber(event.data) ? event.data : null;
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
