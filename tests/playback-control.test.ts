import { describe, expect, test } from "bun:test";
import { getNextPauseForTransportToggle } from "../src/integrations/mpv/playbackControl";

describe("playback transport", () => {
  test("records a user pause while playback is paused for cache", () => {
    const nextPause = getNextPauseForTransportToggle(
      {
        coreIdle: false,
        paused: false,
        pausedForCache: true,
      },
      false,
    );

    expect(nextPause).toBe(true);
  });

  test("resumes a user-paused video", () => {
    const nextPause = getNextPauseForTransportToggle(
      {
        coreIdle: false,
        paused: true,
        pausedForCache: false,
      },
      true,
    );

    expect(nextPause).toBe(false);
  });

  test("starts playback while the player is idle", () => {
    const nextPause = getNextPauseForTransportToggle(
      {
        coreIdle: true,
        paused: true,
        pausedForCache: false,
      },
      true,
    );

    expect(nextPause).toBe(false);
  });
});
