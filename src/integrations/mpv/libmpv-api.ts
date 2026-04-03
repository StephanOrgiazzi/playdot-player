import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type MpvFormat = "string" | "flag" | "int64" | "double" | "node";
export type MpvNodeValue =
  | string
  | boolean
  | number
  | null
  | readonly MpvNodeValue[]
  | { readonly [key: string]: MpvNodeValue };

export type MpvObservableProperty =
  | readonly [string, MpvFormat]
  | readonly [string, MpvFormat, "none", ...MpvNodeValue[]];

export type MpvConfig = {
  initialOptions?: Record<string, string | boolean | number>;
  observedProperties?: readonly MpvObservableProperty[];
};

export type MpvEvent = {
  event: string;
  name?: string;
  data?: MpvNodeValue;
};

export type MpvObservedPropertyEvent = {
  name: string;
  data: MpvNodeValue | undefined;
};

export type VideoMarginRatio = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

export async function init(config?: MpvConfig, windowLabel?: string): Promise<string> {
  const winLabel = windowLabel ?? getCurrentWindow().label;
  const transformedConfig = {
    ...config,
    observedProperties: config?.observedProperties ? Object.fromEntries(config.observedProperties) : {}
  };

  return invoke<string>("plugin:libmpv|init", {
    mpvConfig: transformedConfig,
    windowLabel: winLabel
  });
}

export async function destroy(windowLabel?: string): Promise<void> {
  return invoke("plugin:libmpv|destroy", {
    windowLabel: windowLabel ?? getCurrentWindow().label
  });
}

export async function setProperty(name: string, value: string | boolean | number, windowLabel?: string): Promise<void> {
  return invoke("plugin:libmpv|set_property", {
    name,
    value,
    windowLabel: windowLabel ?? getCurrentWindow().label
  });
}

export async function command(name: string, args: (string | boolean | number)[] = [], windowLabel?: string): Promise<void> {
  return invoke("plugin:libmpv|command", {
    name,
    args,
    windowLabel: windowLabel ?? getCurrentWindow().label
  });
}

export async function listenEvents(callback: (event: MpvEvent) => void, windowLabel?: string): Promise<UnlistenFn> {
  const winLabel = windowLabel ?? getCurrentWindow().label;
  return listen<MpvEvent>(`mpv-event-${winLabel}`, (event) => callback(event.payload));
}

export async function observeProperties(
  properties: readonly MpvObservableProperty[],
  callback: (event: MpvObservedPropertyEvent) => void,
  windowLabel?: string
): Promise<UnlistenFn> {
  const propertyNames = properties.map((property) => property[0]);

  return listenEvents((event) => {
    if (event.event !== "property-change" || !event.name || !propertyNames.includes(event.name)) {
      return;
    }

    callback({ name: event.name, data: event.data });
  }, windowLabel);
}

export async function setVideoMarginRatio(ratio: VideoMarginRatio, windowLabel?: string): Promise<void> {
  return invoke("plugin:libmpv|set_video_margin_ratio", {
    ratio,
    windowLabel: windowLabel ?? getCurrentWindow().label
  });
}
