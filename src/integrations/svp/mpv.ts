import { command, getProperty, type MpvConfig } from "@integrations/mpv/libmpv-api";

const SVP_MPV_INITIAL_OPTIONS: NonNullable<MpvConfig["initialOptions"]> = {
  "input-ipc-server": "mpvpipe",
  "hwdec-codecs": "all",
  "hr-seek-framedrop": "no",
};

export function getSvpMpvInitialOptions(available: boolean): MpvConfig["initialOptions"] {
  if (!available) {
    return undefined;
  }

  return {
    hwdec: "auto-copy",
    ...SVP_MPV_INITIAL_OPTIONS,
  };
}

function getSvpFilterEnabled(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  const marker = "@svp:";
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  return value[markerIndex + marker.length] !== "!";
}

export async function syncSvpMpvFilter(enabled: boolean): Promise<void> {
  const filterEnabled = getSvpFilterEnabled(await getProperty("vf", "string"));
  if (filterEnabled === null || filterEnabled === enabled) {
    return;
  }

  await command("vf", ["toggle", "@svp"]);
}
