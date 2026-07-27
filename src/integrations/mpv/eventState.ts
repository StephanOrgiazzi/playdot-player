import type { PlayerState } from "@features/player/model/playerState";
import { OBSERVED_PROPERTIES } from "./constants";
import type { MpvEvent } from "./libmpv-api";
import { getMpvPlaybackFailure, preparePlayerStateForMediaLoad } from "./sessionState";
import { applyObservedProperty } from "./stateUpdates";

const OBSERVED_PROPERTY_NAMES: ReadonlySet<string> = new Set(
  OBSERVED_PROPERTIES.map(([name]) => name),
);

export type MpvEventSession = {
  state: PlayerState;
  activePlaylistEntryId: number | null;
  mediaLoadPending: boolean;
};

export type MpvEventUpdate = MpvEventSession & {
  emission: "none" | "frame" | "immediate";
  syncSvpFilter: boolean;
  queueOverflow: boolean;
};

function unchanged(session: MpvEventSession): MpvEventUpdate {
  return {
    ...session,
    emission: "none",
    syncSvpFilter: false,
    queueOverflow: false,
  };
}

export function applyMpvEvent(
  session: MpvEventSession,
  event: MpvEvent,
): MpvEventUpdate | null {
  if (event.event === "start-file") {
    return {
      state: preparePlayerStateForMediaLoad(session.state),
      activePlaylistEntryId:
        typeof event.playlist_entry_id === "number" ? event.playlist_entry_id : null,
      mediaLoadPending: false,
      emission: "immediate",
      syncSvpFilter: false,
      queueOverflow: false,
    };
  }

  if (event.event === "file-loaded") {
    const next = unchanged({ ...session, mediaLoadPending: false });
    if (!session.state.playbackError && !session.state.eofReached && !session.state.coreIdle) {
      return next;
    }

    return {
      ...next,
      state: {
        ...session.state,
        playbackError: "",
        eofReached: false,
        coreIdle: false,
      },
      emission: "frame",
    };
  }

  const playbackFailure = getMpvPlaybackFailure(
    event,
    session.activePlaylistEntryId,
    session.mediaLoadPending,
  );
  if (playbackFailure) {
    return {
      ...session,
      state: {
        ...session.state,
        paused: true,
        pausedForCache: false,
        eofReached: false,
        playbackError: playbackFailure,
      },
      mediaLoadPending: false,
      emission: "immediate",
      syncSvpFilter: false,
      queueOverflow: false,
    };
  }

  if (event.event === "queue-overflow") {
    return { ...unchanged(session), queueOverflow: true };
  }

  if (
    event.event !== "property-change" ||
    !event.name ||
    !OBSERVED_PROPERTY_NAMES.has(event.name)
  ) {
    return null;
  }

  if (event.name === "vf") {
    return { ...unchanged(session), syncSvpFilter: true };
  }

  const nextState = applyObservedProperty(session.state, {
    name: event.name,
    data: event.data,
  });
  if (nextState === session.state) {
    return unchanged(session);
  }

  return {
    ...unchanged(session),
    state: nextState,
    emission: "frame",
  };
}
