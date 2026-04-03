import { join, resourceDir } from "@tauri-apps/api/path";
import { getSvpMpvInitialOptions } from "@integrations/svp/mpv";
import type { MpvConfig } from "./libmpv-api";
import {
  MPV_VOLUME_DEFAULT,
  MPV_VOLUME_MAX,
  OBSERVED_PROPERTIES,
  SUBTITLE_ASS_STYLE,
  SUBTITLE_BLEND,
  SUBTITLE_BLUR,
  SUBTITLE_SCALE,
  SUBTITLE_BORDER_COLOR,
  SUBTITLE_BORDER_SIZE,
  SUBTITLE_FONT,
  SUBTITLE_FONT_SIZE,
  SUBTITLE_SHADOW_OFFSET,
} from "./constants";

type MpvResourcePaths = {
  subtitleFontsDir: string | null;
  fsrShaderCandidates: string[];
};

type MpvFeatureFlags = {
  svpEnabled?: boolean;
};

async function getBundledFsrShaderCandidates(resourcesPath: string | null): Promise<string[]> {
  if (!resourcesPath) {
    return [];
  }

  const candidateSegments = [
    ["lib", "shaders", "FSR.glsl"],
    ["shaders", "FSR.glsl"],
    ["_up_", "shaders", "FSR.glsl"],
  ];

  const candidates = await Promise.all(
    candidateSegments.map(async (segments) => join(resourcesPath, ...segments).catch(() => null)),
  );

  return [...new Set(candidates.filter((candidate): candidate is string => candidate !== null))];
}

async function readMpvResourcePaths(): Promise<MpvResourcePaths> {
  const resourcesPath = await resourceDir().catch(() => null);
  const [subtitleFontsDir, fsrShaderCandidates] = await Promise.all([
    resourcesPath ? join(resourcesPath, "lib", "fonts").catch(() => null) : Promise.resolve(null),
    getBundledFsrShaderCandidates(resourcesPath),
  ]);

  return { subtitleFontsDir, fsrShaderCandidates };
}

let mpvResourcePathsPromise: Promise<MpvResourcePaths> | null = null;

export async function getMpvResourcePaths(): Promise<MpvResourcePaths> {
  mpvResourcePathsPromise ??= readMpvResourcePaths();
  return mpvResourcePathsPromise;
}

export async function createMpvConfig(
  resourcePaths?: MpvResourcePaths,
  featureFlags?: MpvFeatureFlags,
): Promise<MpvConfig> {
  const { subtitleFontsDir } = resourcePaths ?? (await getMpvResourcePaths());
  const { svpEnabled = false } = featureFlags ?? {};
  const svpInitialOptions = getSvpMpvInitialOptions(svpEnabled);

  return {
    initialOptions: {
      vo: "gpu-next",
      "gpu-api": "d3d11",
      hwdec: "auto-safe",
      "target-colorspace-hint": "auto",
      "target-colorspace-hint-mode": "target",
      deband: "yes",
      "keep-open": "yes",
      "force-window": "yes",
      pause: "yes",
      ao: "wasapi",
      "audio-exclusive": "no",
      "audio-channels": "auto-safe",
      volume: MPV_VOLUME_DEFAULT,
      "volume-max": MPV_VOLUME_MAX,
      replaygain: "no",
      "replaygain-fallback": "0",
      "replaygain-clip": "no",
      "ad-lavc-ac3drc": 0.35,
      "sub-font": SUBTITLE_FONT,
      "sub-font-size": SUBTITLE_FONT_SIZE,
      "sub-scale": SUBTITLE_SCALE,
      "blend-subtitles": SUBTITLE_BLEND,
      "sub-blur": SUBTITLE_BLUR,
      "sub-border-color": SUBTITLE_BORDER_COLOR,
      "sub-border-size": SUBTITLE_BORDER_SIZE,
      "sub-shadow-offset": SUBTITLE_SHADOW_OFFSET,
      "sub-ass-override": "force",
      "sub-ass-force-style": SUBTITLE_ASS_STYLE,
      ...svpInitialOptions,
      ...(subtitleFontsDir ? { "sub-fonts-dir": subtitleFontsDir } : {}),
    },
    observedProperties: OBSERVED_PROPERTIES,
  };
}
