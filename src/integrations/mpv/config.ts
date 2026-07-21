import { join, resolveResource, resourceDir } from "@tauri-apps/api/path";
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
  upscaleShaderBundles: string[][];
};

type MpvFeatureFlags = {
  audioNormalizerEnabled?: boolean;
  stereoDownmixEnabled?: boolean;
  svpAvailable?: boolean;
};

type MpvPerFileOptions = Readonly<Record<string, string>>;

type MpvThumbnailTarget = {
  rawPath: string;
  width: number;
  height: number;
};

type MpvThumbnailSeek = {
  seconds: number;
  exact: boolean;
};

export const AUDIO_NORMALIZER_FILTER = "lavfi=[loudnorm=I=-16:TP=-1.5:LRA=11]";

const NETWORK_SOURCE_PROTOCOLS = /^(?:https?|ftp|ftps|rtmps?|rtsp|rtsps|srt|udp|tcp|smb):\/\//i;
const UPSCALE_SHADER_FALLBACK_DIRECTORIES = [["lib", "shaders"], ["shaders"], ["_up_", "shaders"]];

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

const MPV_THUMBNAIL_STREAM_LOAD_OPTIONS = {
  ...MPV_STREAM_LOAD_OPTIONS,
  "cache-secs": "15",
  "cache-pause": "no",
  "cache-pause-wait": "1",
  "cache-pause-initial": "no",
  "demuxer-readahead-secs": "5",
  "demuxer-max-bytes": "16MiB",
} as const satisfies MpvPerFileOptions;

export function isMpvNetworkSource(source: string): boolean {
  return NETWORK_SOURCE_PROTOCOLS.test(source.trim());
}

export function getMpvLoadOptionsForSource(
  source: string,
  purpose: "playback" | "thumbnail" = "playback",
): MpvPerFileOptions | null {
  if (!isMpvNetworkSource(source)) {
    return null;
  }

  return purpose === "thumbnail" ? MPV_THUMBNAIL_STREAM_LOAD_OPTIONS : MPV_STREAM_LOAD_OPTIONS;
}

export function getStereoDownmixMpvOptions(
  enabled: boolean,
): NonNullable<MpvConfig["initialOptions"]> {
  return {
    "audio-channels": enabled ? "stereo" : "auto-safe",
    "audio-normalize-downmix": "yes",
    "ad-lavc-downmix": enabled ? "yes" : "no",
  };
}

async function getUpscaleShaderCandidates(
  resourcesPath: string,
  filename: string,
): Promise<string[]> {
  const candidates = await Promise.all(
    UPSCALE_SHADER_FALLBACK_DIRECTORIES.map((segments) =>
      join(resourcesPath, ...segments, filename).catch(() => null),
    ),
  );

  return [...new Set(candidates.filter((candidate): candidate is string => candidate !== null))];
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

  const [fsrCandidates, adaptiveLumaCandidates] = await Promise.all([
    getUpscaleShaderCandidates(resourcesPath, "FSR.glsl"),
    getUpscaleShaderCandidates(resourcesPath, "adaptive-luma-ultra.glsl"),
  ]);

  return fsrCandidates.flatMap((fsrPath) =>
    adaptiveLumaCandidates.map((adaptiveLumaPath) => [fsrPath, adaptiveLumaPath]),
  );
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

async function createMpvInitialOptions(
  resourcePaths?: MpvResourcePaths,
  featureFlags?: MpvFeatureFlags,
): Promise<NonNullable<MpvConfig["initialOptions"]>> {
  const { subtitleFontsDir } = resourcePaths ?? (await getMpvResourcePaths());
  const {
    audioNormalizerEnabled = false,
    stereoDownmixEnabled = false,
    svpAvailable = false,
  } = featureFlags ?? {};
  const svpInitialOptions = getSvpMpvInitialOptions(svpAvailable);

  return {
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
    ...(audioNormalizerEnabled ? { af: AUDIO_NORMALIZER_FILTER } : {}),
    ...getStereoDownmixMpvOptions(stereoDownmixEnabled),
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
  };
}

export async function createMpvConfig(
  resourcePaths?: MpvResourcePaths,
  featureFlags?: MpvFeatureFlags,
): Promise<MpvConfig> {
  return {
    initialOptions: await createMpvInitialOptions(resourcePaths, featureFlags),
    observedProperties: OBSERVED_PROPERTIES,
  };
}

export function createMpvThumbnailConfig(
  target: MpvThumbnailTarget,
  initialSeek: MpvThumbnailSeek,
): MpvConfig {
  return {
    initialOptions: {
      idle: "yes",
      pause: "yes",
      "force-window": "no",
      "keep-open": "always",
      start: initialSeek.seconds,
      "hr-seek": initialSeek.exact ? "yes" : "no",
      audio: "no",
      sub: "no",
      hwdec: "no",
      "demuxer-readahead-secs": 0,
      "demuxer-max-bytes": "128KiB",
      "vd-lavc-skiploopfilter": "all",
      "vd-lavc-fast": "yes",
      "vd-lavc-threads": 2,
      "sws-scaler": "fast-bilinear",
      "target-trc": "srgb",
      "target-prim": "bt.709",
      "tone-mapping": "bt.2390",
      "hdr-compute-peak": "yes",
      "hdr-peak-decay-rate": 0,
      vf: `gpu=api=vulkan:w=${target.width}:h=${target.height},format=fmt=bgra`,
      ovc: "rawvideo",
      of: "image2",
      ofopts: "update=1",
      o: target.rawPath,
    },
  };
}
