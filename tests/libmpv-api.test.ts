import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { command, destroy, init } from "../src/integrations/mpv/libmpv-api";

type IpcCall = {
  command: string;
  payload: object | undefined;
};

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
});

afterEach(() => {
  clearMocks();
});

describe("libmpv window routing", () => {
  test("routes a worker lifecycle to its own native window label", async () => {
    const calls: IpcCall[] = [];
    mockIPC((ipcCommand, payload) => {
      calls.push({ command: ipcCommand, payload });
      return ipcCommand === "plugin:libmpv|init" ? "thumbnail-worker" : undefined;
    });

    await init({ initialOptions: { pause: "yes" } }, "thumbnail-worker");
    await command("seek", [120, "absolute+exact"], "thumbnail-worker");
    await destroy("thumbnail-worker");

    expect(calls).toEqual([
      {
        command: "plugin:libmpv|init",
        payload: {
          mpvConfig: {
            initialOptions: { pause: "yes" },
            observedProperties: {},
          },
          windowLabel: "thumbnail-worker",
        },
      },
      {
        command: "plugin:libmpv|command",
        payload: {
          args: [120, "absolute+exact"],
          name: "seek",
          windowLabel: "thumbnail-worker",
        },
      },
      {
        command: "plugin:libmpv|destroy",
        payload: { windowLabel: "thumbnail-worker" },
      },
    ]);
  });
});
