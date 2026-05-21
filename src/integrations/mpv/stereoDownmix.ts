import type { MpvConfig } from "./libmpv-api";

export const STEREO_DOWNMIX_FILTER_LABEL = "playdot-stereo-downmix";

const STEREO_DOWNMIX_LAVFI_FILTER =
  "lavfi=[acompressor=threshold=0.125:ratio=3:attack=8:release=150:knee=3:makeup=1.35:link=maximum,loudnorm=I=-18:LRA=10:TP=-1.5]";

export const STEREO_DOWNMIX_AUDIO_FILTER = `@${STEREO_DOWNMIX_FILTER_LABEL}:${STEREO_DOWNMIX_LAVFI_FILTER}`;

export function getStereoDownmixMpvInitialOptions(
  enabled: boolean,
): NonNullable<MpvConfig["initialOptions"]> {
  return {
    "audio-channels": enabled ? "stereo" : "auto-safe",
    "audio-normalize-downmix": "yes",
    "ad-lavc-downmix": enabled ? "yes" : "no",
    ...(enabled ? { af: STEREO_DOWNMIX_AUDIO_FILTER } : {}),
  };
}
