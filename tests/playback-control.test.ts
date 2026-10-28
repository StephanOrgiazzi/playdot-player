import { describe, expect, test } from "bun:test";
import { getNextPauseForTransportToggle } from "../src/integrations/mpv/playbackControl";
import { EMPTY_PLAYER_STATE } from "../src/features/player/model/playerState";

describe("playback transport", () => {
  test("records a user pause while playback is paused for cache", () => {
    const state = { ...EMPTY_PLAYER_STATE, coreIdle: true, paused: false, pausedForCache: true };
    const nextPause = getNextPauseForTransportToggle(state, false);

    expect(nextPause).toBe(true);
  });

  test("resumes a user-paused video", () => {
    const nextPause = getNextPauseForTransportToggle(EMPTY_PLAYER_STATE, true);

    expect(nextPause).toBe(false);
  });

  test("starts playback while the player is idle", () => {
    const state = { ...EMPTY_PLAYER_STATE, coreIdle: true, paused: true };
    const nextPause = getNextPauseForTransportToggle(state, true);

    expect(nextPause).toBe(false);
  });

  test("uses the confirmed pause flag when the last event is stale", () => {
    expect(getNextPauseForTransportToggle(EMPTY_PLAYER_STATE, false)).toBe(true);
  });

  test("uses the last observed pause flag if the native read fails", () => {
    expect(getNextPauseForTransportToggle(EMPTY_PLAYER_STATE, null)).toBe(false);
  });
});
