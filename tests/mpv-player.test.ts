import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { MpvPlayer } from "../src/integrations/mpv/MpvPlayer";

type IpcCall = { command: string; payload: object | undefined };
type NativeState = {
  path: string | null;
  timePos: number | null;
  duration: number | null;
  seekable: boolean;
  eofReached: boolean;
  paused: boolean;
};

let previousWindow: PropertyDescriptor | undefined;

beforeEach(() => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { requestAnimationFrame: () => 1, cancelAnimationFrame: () => undefined },
  });
  mockWindows("main");
});

afterEach(() => {
  clearMocks();
  if (previousWindow) {
    Object.defineProperty(globalThis, "window", previousWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

function setupNative(overrides: Partial<NativeState> = {}) {
  const state: NativeState = {
    path: "https://example.com/movie.mkv",
    timePos: 600,
    duration: 3600,
    seekable: true,
    eofReached: true,
    paused: true,
    ...overrides,
  };
  const calls: IpcCall[] = [];
  const fixture = {
    calls,
    player: new MpvPlayer(),
    getPath: (): Promise<string | null> => Promise.resolve(state.path),
  };

  mockIPC((command, payload) => {
    fixture.calls.push({ command, payload });
    if (command === "plugin:libmpv|get_property" && payload && "name" in payload) {
      switch (payload.name) {
        case "pause":
          return state.paused;
        case "eof-reached":
          return state.eofReached;
        case "path":
          return fixture.getPath();
        case "time-pos":
          return state.timePos;
        case "duration":
          return state.duration;
        case "seekable":
          return state.seekable;
      }
    }
    if (
      command === "plugin:libmpv|set_property" &&
      payload &&
      "name" in payload &&
      payload.name === "pause" &&
      "value" in payload
    ) {
      state.paused = payload.value === true;
    }
    return null;
  });
  return fixture;
}

function expectRestart(calls: IpcCall[], path: string, startSeconds: number): void {
  expect(calls.filter((call) => call.command === "plugin:libmpv|command")).toEqual([
    {
      command: "plugin:libmpv|command",
      payload: {
        name: "loadfile",
        args: [path, "replace", -1, expect.objectContaining({ start: String(startSeconds) })],
        windowLabel: "main",
      },
    },
  ]);
}

describe("native playback recovery", () => {
  test("reopens an interrupted streamed video at its last position when Play is pressed", async () => {
    const { player, calls } = setupNative();
    await player.togglePlayPause();
    expectRestart(calls, "https://example.com/movie.mkv", 600);
    expect(player.getSnapshot().paused).toBe(false);
    expect(calls).not.toContainEqual(
      expect.objectContaining({
        command: "plugin:libmpv|set_property",
        payload: expect.objectContaining({ name: "gamma" }),
      }),
    );
  });

  test("replays a completed video from the beginning", async () => {
    const { player, calls } = setupNative({ timePos: 3599.5 });
    await player.togglePlayPause();
    expectRestart(calls, "https://example.com/movie.mkv", 0);
  });

  test("reopens a non-seekable live stream without a stale seek position", async () => {
    const { player, calls } = setupNative({ duration: null, seekable: false });
    await player.togglePlayPause();
    expectRestart(calls, "https://example.com/movie.mkv", 0);
  });

  test("replays a completed local file from the beginning", async () => {
    const path = "C:\\media\\movie.mkv";
    const { player, calls } = setupNative({ path });
    await player.togglePlayPause();
    expectRestart(calls, path, 0);
  });

  test("pauses a buffering stream without reloading it", async () => {
    const { player, calls } = setupNative({ eofReached: false, paused: false });
    await player.togglePlayPause();
    expect(player.getSnapshot().paused).toBe(true);
    expect(calls.filter((call) => call.command === "plugin:libmpv|command")).toEqual([]);
  });

  test("does not reopen the old stream if another media was opened during the native reads", async () => {
    const fixture = setupNative();
    const pathRequested = Promise.withResolvers<void>();
    const pathResult = Promise.withResolvers<string>();
    fixture.getPath = () => {
      pathRequested.resolve();
      return pathResult.promise;
    };

    const restart = fixture.player.togglePlayPause();
    await pathRequested.promise;
    await fixture.player.loadFile("C:\\media\\new.mkv");
    pathResult.resolve("https://example.com/movie.mkv");
    await restart;

    expect(fixture.calls.filter((call) => call.command === "plugin:libmpv|command")).toEqual([
      {
        command: "plugin:libmpv|command",
        payload: { name: "loadfile", args: ["C:\\media\\new.mkv"], windowLabel: "main" },
      },
    ]);
  });
});
