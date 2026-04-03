import type { MpvObservableProperty } from "./libmpv-api";

export const MPV_VOLUME_MAX = 150;
export const MPV_VOLUME_DEFAULT = 150;
export const UI_VOLUME_MAX = 100;
export const DEFAULT_PLAYBACK_SPEED = 1;
export const SUBTITLE_SCALE = 1;
export const SUBTITLE_FONT = "Inter ExtraBold";
export const SUBTITLE_FONT_SIZE = 62;
export const SUBTITLE_BLEND = "no";
export const SUBTITLE_BLUR = 1.25;
export const SUBTITLE_BORDER_COLOR = "#000000";
export const SUBTITLE_BORDER_SIZE = 0.1;
export const SUBTITLE_SHADOW_OFFSET = 1.5;

const SUBTITLE_PRIMARY_COLOUR = "&H00FFFFFF";
const SUBTITLE_OUTLINE_COLOUR = "&H00000000";
const SUBTITLE_BACK_COLOUR = "&H80000000";
const SUBTITLE_BOLD = 0;
const SUBTITLE_BORDER_STYLE = 1;
const SUBTITLE_OUTLINE = SUBTITLE_BORDER_SIZE;
const SUBTITLE_SHADOW = SUBTITLE_SHADOW_OFFSET;
const SUBTITLE_SPACING = 0.0;
const SUBTITLE_MARGIN_LEFT = 30;
const SUBTITLE_MARGIN_RIGHT = 30;
const SUBTITLE_MARGIN_BOTTOM = 45;
const SUBTITLE_ALIGNMENT = 2;

export const SUBTITLE_ASS_STYLE =
  `FontName=${SUBTITLE_FONT},FontSize=${SUBTITLE_FONT_SIZE},PrimaryColour=${SUBTITLE_PRIMARY_COLOUR},OutlineColour=${SUBTITLE_OUTLINE_COLOUR},BackColour=${SUBTITLE_BACK_COLOUR},Bold=${SUBTITLE_BOLD},BorderStyle=${SUBTITLE_BORDER_STYLE},Outline=${SUBTITLE_OUTLINE},Shadow=${SUBTITLE_SHADOW},Blur=${SUBTITLE_BLUR},Spacing=${SUBTITLE_SPACING},MarginL=${SUBTITLE_MARGIN_LEFT},MarginR=${SUBTITLE_MARGIN_RIGHT},MarginV=${SUBTITLE_MARGIN_BOTTOM},Alignment=${SUBTITLE_ALIGNMENT}`;

export const OBSERVED_PROPERTIES = [
  ["pause", "flag"],
  ["time-pos", "double", "none"],
  ["duration", "double", "none"],
  ["volume", "double"],
  ["mute", "flag"],
  ["speed", "double"],
  ["filename", "string", "none"],
  ["aid", "int64", "none"],
  ["sid", "int64", "none"],
  ["track-list", "node"],
] as const satisfies MpvObservableProperty[];

export function clampMpvVolume(value: number): number {
  return Math.min(MPV_VOLUME_MAX, Math.max(0, value));
}

export function clampUiVolume(value: number): number {
  return Math.min(UI_VOLUME_MAX, Math.max(0, value));
}

export function getUiVolumeFromMpvVolume(value: number): number {
  return (clampMpvVolume(value) / MPV_VOLUME_DEFAULT) * UI_VOLUME_MAX;
}

export function getMpvVolumeFromUiVolume(value: number): number {
  return (clampUiVolume(value) / UI_VOLUME_MAX) * MPV_VOLUME_DEFAULT;
}
