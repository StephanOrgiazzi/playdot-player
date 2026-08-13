import { Schema } from "effect";
import { getSelectedTrackByType, getTracksByType } from "@features/player/model/playerSelectors";
import type { MediaTrack, PlayerState } from "@features/player/model/playerState";
import type { MpvNodeValue } from "./libmpv-api";

export type TrackSelection = number | "no";

const isMpvString = Schema.is(Schema.String);
const isMpvNumber = Schema.is(Schema.Number);
const isMpvBoolean = Schema.is(Schema.Boolean);
const isMpvNodeObjectValue = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

function isMpvNodeObject(value: MpvNodeValue): value is { readonly [key: string]: MpvNodeValue } {
  return isMpvNodeObjectValue(value);
}

function isMpvNodeArray(value: MpvNodeValue | undefined): value is readonly MpvNodeValue[] {
  return Array.isArray(value);
}

export function parseTracks(node: MpvNodeValue | undefined): MediaTrack[] {
  if (!isMpvNodeArray(node)) {
    return [];
  }

  return node
    .map((value) => {
      if (!isMpvNodeObject(value)) {
        return null;
      }

      const type =
        value.type === "audio" || value.type === "sub" || value.type === "video"
          ? value.type
          : null;
      const id = isMpvNumber(value.id) ? value.id : null;

      if (!type || id === null) {
        return null;
      }

      const title =
        isMpvString(value.title) && value.title.trim().length > 0 ? value.title : `${type} ${id}`;

      const track: MediaTrack = {
        id,
        type,
        title,
        selected: isMpvBoolean(value.selected) && value.selected,
        external: isMpvBoolean(value.external) && value.external,
        albumart: isMpvBoolean(value.albumart) && value.albumart,
      };

      if (isMpvString(value.lang)) {
        track.lang = value.lang;
      }

      return track;
    })
    .filter((track): track is MediaTrack => track !== null);
}

export function getNextAudioTrackSelection(state: PlayerState): number | null {
  const audioTracks = getTracksByType(state, "audio");
  if (audioTracks.length < 2) {
    return null;
  }

  const selectedTrack = getSelectedTrackByType(state, "audio");
  const selectedIndex = selectedTrack
    ? audioTracks.findIndex((track) => track.id === selectedTrack.id)
    : -1;
  const nextTrack = audioTracks[(selectedIndex + 1 + audioTracks.length) % audioTracks.length];

  return nextTrack?.id === selectedTrack?.id ? null : (nextTrack?.id ?? null);
}

export function getNextSubtitleTrackSelection(state: PlayerState): TrackSelection | null {
  const subtitleTracks = getTracksByType(state, "sub");
  if (subtitleTracks.length === 0) {
    return null;
  }

  const selectedTrack = getSelectedTrackByType(state, "sub");
  if (!selectedTrack) {
    return subtitleTracks[0]?.id ?? null;
  }

  const selectedIndex = subtitleTracks.findIndex((track) => track.id === selectedTrack.id);
  const nextSubtitleTrack = subtitleTracks[selectedIndex + 1];

  return selectedIndex >= subtitleTracks.length - 1 || !nextSubtitleTrack
    ? "no"
    : nextSubtitleTrack.id;
}
