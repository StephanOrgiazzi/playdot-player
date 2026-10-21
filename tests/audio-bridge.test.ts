import { describe, expect, test } from "bun:test";
import {
  AudioBridgeController,
  type AudioBridgeTransport,
} from "../src/integrations/mpv/audioBridge";

function setup(overrides: Partial<AudioBridgeTransport> = {}) {
  const calls: string[] = [];
  const host: AudioBridgeTransport = {
    readDevice: async () => "wasapi/previous",
    start: async () => {
      calls.push("start");
      return "wasapi/projector";
    },
    stop: async () => {
      calls.push("stop");
    },
    writeDevice: async (device) => {
      calls.push(device);
    },
    setDisplayMode: async (mode) => {
      calls.push(mode);
    },
    ...overrides,
  };
  return { calls, controller: new AudioBridgeController(host) };
}

describe("Dolby Surround audio and display switching", () => {
  test("duplicates before opening HDMI, then stops capture before returning to PC only", async () => {
    const { controller, calls } = setup();
    await controller.enable();
    expect(controller.enabled).toBe(true);
    await controller.disable();
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual([
      "duplicate",
      "start",
      "wasapi/projector",
      "stop",
      "pcOnly",
      "wasapi/previous",
    ]);
  });

  test("does not change the playback route when the native outputs cannot open", async () => {
    const { controller, calls } = setup({
      start: async () => {
        throw new Error("D1Max unavailable");
      },
    });
    await expect(controller.enable()).rejects.toThrow("D1Max unavailable");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual(["duplicate", "stop", "pcOnly", "wasapi/previous"]);
  });

  test("stops the mirror and restores the route when mpv cannot select HDMI", async () => {
    const writes: string[] = [];
    const { controller, calls } = setup({
      writeDevice: async (device) => {
        writes.push(device);
        if (device === "wasapi/projector") throw new Error("HDMI unavailable");
      },
    });
    await expect(controller.enable()).rejects.toThrow("HDMI unavailable");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual(["duplicate", "start", "stop", "pcOnly"]);
    expect(writes).toEqual(["wasapi/projector", "wasapi/previous"]);
  });

  test("queues cleanup behind an activation that has not finished yet", async () => {
    let release: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { controller, calls } = setup({
      start: async () => {
        await started;
        calls.push("start");
        return "wasapi/projector";
      },
    });
    const enable = controller.enable();
    const cleanup = controller.disable();
    release?.();
    await Promise.all([enable, cleanup]);
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual([
      "duplicate",
      "start",
      "wasapi/projector",
      "stop",
      "pcOnly",
      "wasapi/previous",
    ]);
  });

  test("stops the native mirror even when restoring the old output fails", async () => {
    const { controller, calls } = setup({
      writeDevice: async (device) => {
        if (device === "wasapi/previous") throw new Error("previous output unplugged");
      },
    });
    await controller.enable();
    await expect(controller.disable()).rejects.toThrow("previous output unplugged");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual(["duplicate", "start", "stop", "pcOnly"]);
  });

  test("does not start audio or change the display again when duplication fails", async () => {
    const { controller, calls } = setup({
      setDisplayMode: async (mode) => {
        calls.push(mode);
        throw new Error("Windows refused duplication");
      },
    });
    await expect(controller.enable()).rejects.toThrow("Windows refused duplication");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual(["duplicate"]);
  });

  test("still restores audio and clears the toggle when PC-only switching fails", async () => {
    const { controller, calls } = setup({
      setDisplayMode: async (mode) => {
        calls.push(mode);
        if (mode === "pcOnly") throw new Error("Windows refused PC only");
      },
    });
    await controller.enable();
    await expect(controller.disable()).rejects.toThrow("Windows refused PC only");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual([
      "duplicate",
      "start",
      "wasapi/projector",
      "stop",
      "pcOnly",
      "wasapi/previous",
    ]);
  });

  test("still switches to PC only and restores audio when stopping capture fails", async () => {
    const { controller, calls } = setup({
      stop: async () => {
        calls.push("stop");
        throw new Error("Mirror stop failed");
      },
    });
    await controller.enable();
    await expect(controller.disable()).rejects.toThrow("Mirror stop failed");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual([
      "duplicate",
      "start",
      "wasapi/projector",
      "stop",
      "pcOnly",
      "wasapi/previous",
    ]);
  });

  test("reports the activation error alongside a failed display rollback", async () => {
    const { controller, calls } = setup({
      start: async () => {
        throw new Error("D1Max unavailable");
      },
      setDisplayMode: async (mode) => {
        calls.push(mode);
        if (mode === "pcOnly") throw new Error("Windows refused PC only");
      },
    });
    let message = "";
    try {
      await controller.enable();
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("D1Max unavailable");
    expect(message).toContain("Windows refused PC only");
    expect(controller.enabled).toBe(false);
    expect(calls).toEqual(["duplicate", "stop", "pcOnly", "wasapi/previous"]);
  });
});
