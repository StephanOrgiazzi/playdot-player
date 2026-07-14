import type { MpvConfig } from "./libmpv-api";

export const AUDIO_NORMALIZER_FILTER =
  "lavfi=[acompressor=threshold=0.05:ratio=6:attack=10:release=500:makeup=4:knee=4,alimiter=limit=0.95:attack=5:release=50]";

export function getAudioNormalizerMpvInitialOptions(
  enabled: boolean,
): NonNullable<MpvConfig["initialOptions"]> {
  return enabled ? { af: AUDIO_NORMALIZER_FILTER } : {};
}
