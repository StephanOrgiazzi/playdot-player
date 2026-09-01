import { describe, expect, test } from "bun:test";
import { createMpvConfig } from "../src/integrations/mpv/config";

const resourcePaths = {
  subtitleFontsDir: null,
  upscaleShaderBundles: [],
};

describe("mpv initialization profiles", () => {
  test("uses the preferred renderer by default", async () => {
    const config = await createMpvConfig(resourcePaths);

    expect(config.initialOptions?.vo).toBe("gpu-next");
    expect(config.initialOptions?.["gpu-api"]).toBe("d3d11");
    expect(config.initialOptions?.hwdec).toBe("auto-safe");
    expect(config.initialOptions?.["target-colorspace-hint"]).toBe("auto");
  });

  test("uses conservative rendering options for compatibility fallback", async () => {
    const config = await createMpvConfig(resourcePaths, {}, "compatibility");

    expect(config.initialOptions?.vo).toBe("gpu");
    expect(config.initialOptions?.["gpu-api"]).toBe("d3d11");
    expect(config.initialOptions?.hwdec).toBe("no");
    expect(config.initialOptions?.["target-colorspace-hint"]).toBeUndefined();
    expect(config.initialOptions?.["target-colorspace-hint-mode"]).toBeUndefined();
  });
});
