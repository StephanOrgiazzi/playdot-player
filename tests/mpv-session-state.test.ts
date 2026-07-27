import { describe, expect, test } from "bun:test";
import { EMPTY_PLAYER_STATE, type PlayerState } from "../src/features/player/model/playerState";
import {
  getMpvPlaybackFailure,
  preparePlayerStateForMediaLoad,
} from "../src/integrations/mpv/sessionState";

function createLoadedState(): PlayerState {
  return {
    ...EMPTY_PLAYER_STATE,
    initialized: true,
    paused: false,
    pausedForCache: true,
    coreIdle: true,
    eofReached: true,
    timePos: 42,
    duration: 120,
    volume: 73,
    mute: true,
    playbackSpeed: 1.25,
    filename: "old.mkv",
    playbackError: "old failure",
    selectedAudioTrackId: 2,
    selectedSubtitleTrackId: 4,
    isAudioArtworkActive: true,
    audioArtworkUrl: "asset://artwork",
    tracks: [
      {
        id: 2,
        type: "audio",
        title: "English",
        selected: true,
        external: false,
        albumart: false,
      },
    ],
  };
}

describe("preparePlayerStateForMediaLoad", () => {
  test("clears per-media state without discarding user settings", () => {
    const next = preparePlayerStateForMediaLoad(createLoadedState());

    expect(next).toMatchObject({
      initialized: true,
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
      volume: 73,
      mute: true,
      playbackSpeed: 1.25,
      isAudioArtworkActive: true,
      audioArtworkUrl: "asset://artwork",
    });
  });
});

describe("getMpvPlaybackFailure", () => {
  test("reports an error for the active playlist entry", () => {
    expect(
      getMpvPlaybackFailure(
        {
          event: "end-file",
          reason: "error",
          error: -13,
          playlist_entry_id: 7,
        },
        7,
        false,
      ),
    ).toBe("Playback failed (mpv error -13)");
  });

  test("ignores stale errors from a replaced playlist entry", () => {
    expect(
      getMpvPlaybackFailure(
        {
          event: "end-file",
          reason: "error",
          error: -13,
          playlist_entry_id: 6,
        },
        7,
        false,
      ),
    ).toBeNull();
  });

  test("ignores end-file events while a replacement has not started", () => {
    expect(
      getMpvPlaybackFailure(
        { event: "end-file", reason: "error", error: -13 },
        null,
        true,
      ),
    ).toBeNull();
  });

  test("does not classify normal eof as a playback failure", () => {
    expect(
      getMpvPlaybackFailure({ event: "end-file", reason: "eof" }, 7, false),
    ).toBeNull();
  });
});
