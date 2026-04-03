import type { MpvConfig } from "@integrations/mpv/libmpv-api";

const SVP_MPV_INITIAL_OPTIONS: NonNullable<MpvConfig["initialOptions"]> = {
  "input-ipc-server": "mpvpipe",
  "hwdec-codecs": "all",
  "hr-seek-framedrop": "no",
};

export function getSvpMpvInitialOptions(enabled: boolean): MpvConfig["initialOptions"] {
  if (!enabled) {
    return undefined;
  }

  return {
    hwdec: "auto-copy",
    ...SVP_MPV_INITIAL_OPTIONS,
  };
}
