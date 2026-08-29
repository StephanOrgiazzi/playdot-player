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

function updateField<Key extends keyof PlayerState>(
  state: PlayerState,
  key: Key,
  value: PlayerState[Key],
): PlayerState {
  return value === state[key] ? state : { ...state, [key]: value };
}

type PropertyUpdater = (state: PlayerState, value: MpvNodeValue | undefined) => PlayerState;

const PROPERTY_UPDATERS = {
  pause: (state, value) => updateField(state, "paused", isMpvBoolean(value) ? value : false),
  "paused-for-cache": (state, value) =>
    updateField(state, "pausedForCache", isMpvBoolean(value) ? value : false),
  "core-idle": (state, value) =>
    updateField(state, "coreIdle", isMpvBoolean(value) ? value : false),
  "time-pos": (state, value) => updateField(state, "timePos", getNumberOrZero(value)),
  duration: (state, value) => updateField(state, "duration", getNumberOrZero(value)),
  volume: (state, value) => updateField(state, "volume", isMpvNumber(value) ? value : state.volume),
  mute: (state, value) => updateField(state, "mute", isMpvBoolean(value) ? value : state.mute),
  speed: (state, value) =>
    updateField(state, "playbackSpeed", isMpvNumber(value) ? value : state.playbackSpeed),
  filename: (state, value) => updateField(state, "filename", isMpvString(value) ? value : ""),
  aid: (state, value) =>
    updateField(state, "selectedAudioTrackId", isMpvNumber(value) ? value : null),
  sid: (state, value) =>
    updateField(state, "selectedSubtitleTrackId", isMpvNumber(value) ? value : null),
  "track-list": (state, value) => {
    const tracks = parseTracks(value);
    return tracksAreEqual(state.tracks, tracks) ? state : { ...state, tracks };
  },
} satisfies Readonly<Record<string, PropertyUpdater>>;

function hasPropertyUpdater(name: string): name is keyof typeof PROPERTY_UPDATERS {
  return Object.hasOwn(PROPERTY_UPDATERS, name);
}

export function applyObservedProperty(
  state: PlayerState,
  event: MpvObservedPropertyEvent,
): PlayerState {
  return hasPropertyUpdater(event.name) ? PROPERTY_UPDATERS[event.name](state, event.data) : state;
}
