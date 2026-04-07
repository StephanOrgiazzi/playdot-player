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

function getWindowLabel(windowLabel?: string): string {
  return windowLabel ?? getCurrentWindow().label;
}

type InvokePayloadValue = string | boolean | number | object | null | undefined;

function invokeMpv<T>(command: string, payload: Record<string, InvokePayloadValue> = {}, windowLabel?: string): Promise<T> {
  return invoke<T>(`plugin:libmpv|${command}`, {
    ...payload,
    windowLabel: getWindowLabel(windowLabel),
  });
}

export async function init(config?: MpvConfig, windowLabel?: string): Promise<string> {
  return invokeMpv<string>("init", {
    mpvConfig: {
      ...config,
      observedProperties: Object.fromEntries(config?.observedProperties ?? []),
    },
  }, windowLabel);
}

export async function destroy(windowLabel?: string): Promise<void> {
  return invokeMpv("destroy", {}, windowLabel);
}

export async function setProperty(name: string, value: MpvNodeValue, windowLabel?: string): Promise<void> {
  return invokeMpv("set_property", {
    name,
    value,
  }, windowLabel);
}

export async function getProperty<T = MpvNodeValue>(
  name: string,
  format: MpvFormat,
  windowLabel?: string,
): Promise<T | null> {
  return invokeMpv<T | null>("get_property", {
    name,
    format,
  }, windowLabel);
}

export async function command(name: string, args: (string | boolean | number)[] = [], windowLabel?: string): Promise<void> {
  return invokeMpv("command", {
    name,
    args,
  }, windowLabel);
}

export async function listenEvents(callback: (event: MpvEvent) => void, windowLabel?: string): Promise<UnlistenFn> {
  return listen<MpvEvent>(`mpv-event-${getWindowLabel(windowLabel)}`, (event) =>{  callback(event.payload); });
}

export async function observeProperties(
  properties: readonly MpvObservableProperty[],
  callback: (event: MpvObservedPropertyEvent) => void,
  windowLabel?: string
): Promise<UnlistenFn> {
  const propertyNames = new Set(properties.map(([name]) => name));

  return listenEvents((event) => {
    if (event.event !== "property-change" || !event.name || !propertyNames.has(event.name)) {
      return;
    }

    callback({ name: event.name, data: event.data });
  }, windowLabel);
}

export async function setVideoMarginRatio(ratio: VideoMarginRatio, windowLabel?: string): Promise<void> {
  return invokeMpv("set_video_margin_ratio", {
    ratio,
  }, windowLabel);
}
