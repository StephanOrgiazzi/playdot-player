import { join, resolveResource, resourceDir } from "@tauri-apps/api/path";
import { getSvpMpvInitialOptions } from "@integrations/svp/mpv";
import { getAudioNormalizerMpvInitialOptions } from "./audioNormalizer";
import { getStereoDownmixMpvInitialOptions } from "./stereoDownmix";
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
  upscaleShaderBundles: string[][];
};

type MpvFeatureFlags = {
  audioNormalizerEnabled?: boolean;
  stereoDownmixEnabled?: boolean;
  svpEnabled?: boolean;
};

type MpvPerFileOptions = Readonly<Record<string, string>>;

const NETWORK_SOURCE_PROTOCOLS = /^(?:https?|ftp|ftps|rtmps?|rtsp|rtsps|srt|udp|tcp|smb):\/\//i;

export const MPV_STREAM_LOAD_OPTIONS = {
  cache: "yes",
  "cache-secs": "120",
  "cache-pause": "yes",
  "cache-pause-wait": "5",
  "cache-pause-initial": "yes",
  "demuxer-readahead-secs": "60",
  "demuxer-max-bytes": "256MiB",
  "network-timeout": "20",
  "curl-max-retries": "8",
  "curl-connect-timeout": "10",
  "curl-buffer-size": "8MiB",
  "stream-lavf-o":
    "reconnect=1,reconnect_at_eof=1,reconnect_streamed=1,reconnect_delay_max=10,timeout=20000000",
} as const satisfies MpvPerFileOptions;

export function isMpvNetworkSource(source: string): boolean {
  return NETWORK_SOURCE_PROTOCOLS.test(source.trim());
}

export function getMpvLoadOptionsForSource(source: string): MpvPerFileOptions | null {
  return isMpvNetworkSource(source) ? MPV_STREAM_LOAD_OPTIONS : null;
}

async function getBundledUpscaleShaderBundles(resourcesPath: string | null): Promise<string[][]> {
  const [resolvedFsrPath, resolvedAdaptiveLumaPath] = await Promise.all([
    resolveResource("../shaders/FSR.glsl").catch(() => null),
    resolveResource("../shaders/adaptive-luma-ultra.glsl").catch(() => null),
  ]);

  if (resolvedFsrPath && resolvedAdaptiveLumaPath) {
    return [[resolvedFsrPath, resolvedAdaptiveLumaPath]];
  }

  if (!resourcesPath) {
    return [];
  }

  const fallbackCandidateSegments = [["lib", "shaders"], ["shaders"], ["_up_", "shaders"]];

  const [fsrCandidatesRaw, adaptiveLumaCandidatesRaw] = await Promise.all([
    Promise.all(
      fallbackCandidateSegments.map(async (segments) =>
        join(resourcesPath, ...segments, "FSR.glsl").catch(() => null),
      ),
    ),
    Promise.all(
      fallbackCandidateSegments.map(async (segments) =>
        join(resourcesPath, ...segments, "adaptive-luma-ultra.glsl").catch(() => null),
      ),
    ),
  ]);

  const fsrCandidates = [
    ...new Set(fsrCandidatesRaw.filter((candidate): candidate is string => candidate !== null)),
  ];
  const adaptiveLumaCandidates = [
    ...new Set(
      adaptiveLumaCandidatesRaw.filter((candidate): candidate is string => candidate !== null),
    ),
  ];

  const validBundles: string[][] = [];
  for (const fsrPath of fsrCandidates) {
    for (const adaptiveLumaPath of adaptiveLumaCandidates) {
      validBundles.push([fsrPath, adaptiveLumaPath]);
    }
  }

  const uniqueBundles = new Map<string, string[]>();
  for (const bundle of validBundles) {
    uniqueBundles.set(bundle.join("\n"), bundle);
  }

  return [...uniqueBundles.values()];
}

async function readMpvResourcePaths(): Promise<MpvResourcePaths> {
  const resourcesPath = await resourceDir().catch(() => null);
  const [subtitleFontsDir, upscaleShaderBundles] = await Promise.all([
    resourcesPath ? join(resourcesPath, "lib", "fonts").catch(() => null) : Promise.resolve(null),
    getBundledUpscaleShaderBundles(resourcesPath),
  ]);

  return {
    subtitleFontsDir,
    upscaleShaderBundles,
  };
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
  const {
    audioNormalizerEnabled = false,
    stereoDownmixEnabled = false,
    svpEnabled = false,
  } = featureFlags ?? {};
  const audioNormalizerInitialOptions = getAudioNormalizerMpvInitialOptions(audioNormalizerEnabled);
  const stereoDownmixInitialOptions = getStereoDownmixMpvInitialOptions(stereoDownmixEnabled);
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
      "audio-format": "float",
      "audio-pitch-correction": "yes",
      "audio-resample-filter-size": 32,
      "audio-resample-phase-shift": 10,
      "audio-resample-linear": "no",
      volume: MPV_VOLUME_DEFAULT,
      "volume-max": MPV_VOLUME_MAX,
      replaygain: "no",
      "replaygain-fallback": "0",
      "replaygain-clip": "no",
      "ad-lavc-ac3drc": 0,
      ...audioNormalizerInitialOptions,
      ...stereoDownmixInitialOptions,
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
