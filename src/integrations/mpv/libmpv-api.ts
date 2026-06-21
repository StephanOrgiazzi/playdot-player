import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type MpvFormat = "string" | "flag" | "int64" | "double" | "node";
export type MpvFormatValue = {
  string: string;
  flag: boolean;
  int64: number;
  double: number;
  node: MpvNodeValue;
};
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

function invokeMpv<T>(
  command: string,
  payload: Record<string, InvokePayloadValue> = {},
  windowLabel?: string,
  instanceLabel?: string,
): Promise<T> {
  return invoke<T>(`plugin:libmpv|${command}`, {
    ...payload,
    windowLabel: getWindowLabel(windowLabel),
    ...(instanceLabel ? { instanceLabel } : {}),
  });
}

export async function init(
  config?: MpvConfig,
  windowLabel?: string,
  instanceLabel?: string,
): Promise<string> {
  return invokeMpv<string>(
    "init",
    {
      mpvConfig: {
        ...config,
        observedProperties: Object.fromEntries(config?.observedProperties ?? []),
      },
    },
    windowLabel,
    instanceLabel,
  );
}

export async function destroy(windowLabel?: string, instanceLabel?: string): Promise<void> {
  return invokeMpv("destroy", {}, windowLabel, instanceLabel);
}

export async function setProperty(
  name: string,
  value: MpvNodeValue,
  windowLabel?: string,
  instanceLabel?: string,
): Promise<void> {
  return invokeMpv(
    "set_property",
    {
      name,
      value,
    },
    windowLabel,
    instanceLabel,
  );
}

export async function getProperty<T extends MpvFormat>(
  name: string,
  format: T,
  windowLabel?: string,
  instanceLabel?: string,
): Promise<MpvFormatValue[T] | null> {
  return invokeMpv(
    "get_property",
    {
      name,
      format,
    },
    windowLabel,
    instanceLabel,
  );
}

export async function command(
  name: string,
  args: MpvNodeValue[] = [],
  windowLabel?: string,
  instanceLabel?: string,
): Promise<void> {
  return invokeMpv(
    "command",
    {
      name,
      args,
    },
    windowLabel,
    instanceLabel,
  );
}

export async function listenEvents(
  callback: (event: MpvEvent) => void,
  windowLabel?: string,
): Promise<UnlistenFn> {
  return listen<MpvEvent>(`mpv-event-${getWindowLabel(windowLabel)}`, (event) => {
    callback(event.payload);
  });
}

export async function observeProperties(
  properties: readonly MpvObservableProperty[],
  callback: (event: MpvObservedPropertyEvent) => void,
  windowLabel?: string,
): Promise<UnlistenFn> {
  const propertyNames = new Set(properties.map(([name]) => name));

  return listenEvents((event) => {
    if (event.event !== "property-change" || !event.name || !propertyNames.has(event.name)) {
      return;
    }

    callback({ name: event.name, data: event.data });
  }, windowLabel);
}

export async function setVideoMarginRatio(
  ratio: VideoMarginRatio,
  windowLabel?: string,
  instanceLabel?: string,
): Promise<void> {
  return invokeMpv(
    "set_video_margin_ratio",
    {
      ratio,
    },
    windowLabel,
    instanceLabel,
  );
}
