import type { MpvConfig } from "./libmpv-api";

export function getStereoDownmixMpvInitialOptions(
  enabled: boolean,
): NonNullable<MpvConfig["initialOptions"]> {
  return {
    "audio-channels": enabled ? "stereo" : "auto-safe",
    "audio-normalize-downmix": "yes",
    "ad-lavc-downmix": enabled ? "yes" : "no",
  };
}
