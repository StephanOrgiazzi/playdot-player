import type { MediaTrack } from "@features/player/model/playerState";
import type { ToastState, TrackKind } from "./types";

function createToast(message: string): ToastState {
  return {
    message,
    visible: true,
  };
}

function formatPercent(value: number): string {
  return `${Math.max(1, Math.round(value))}%`;
}

function formatPlaybackSpeed(speed: number): string {
  return `${speed.toFixed(2).replace(/\.?0+$/, "")}x`;
}

function getTrackCounter(
  tracks: Array<{ id: number }>,
  selectedTrack: { id: number } | undefined,
): string | null {
  const total = tracks.length;

  if (total === 0 || !selectedTrack) {
    return null;
  }

  const selectedIndex = tracks.findIndex((track) => track.id === selectedTrack.id) + 1;
  return `${Math.max(1, selectedIndex)}/${total}`;
}

function getTrackLabel(
  track: { title: string; lang?: string; external: boolean } | undefined,
  fallback: string,
): string {
  if (!track) {
    return fallback;
  }

  const primary = track.title.trim() || track.lang?.trim() || fallback;
  const language = track.lang?.trim();

  if (language && primary.localeCompare(language, undefined, { sensitivity: "accent" }) !== 0) {
    return `${primary} (${language})${track.external ? " · External" : ""}`;
  }

  return `${primary}${track.external ? " · External" : ""}`;
}

export function createFsrToast(enabled: boolean): ToastState {
  return createToast(enabled ? "Upscale ON" : "Upscale OFF");
}

export function createSvpToast(enabled: boolean): ToastState {
  return createToast(enabled ? "SVP ON" : "SVP OFF");
}

export function createVolumeToast(volume: number): ToastState {
  return createToast(`Volume ${Math.round(volume)}%`);
}

export function createMuteToast(muted: boolean): ToastState {
  return createToast(muted ? "Muted" : "Unmuted");
}

export function createPlaybackSpeedToast(
  direction: "increase" | "decrease",
  speed: number,
): ToastState {
  const prefix = direction === "increase" ? "Speed Up" : "Slow Down";
  return createToast(`${prefix} (${formatPlaybackSpeed(speed)})`);
}

export function createZoomToast(direction: "in" | "out", zoom: number): ToastState {
  const zoomPercent = formatPercent(100 * 2 ** zoom);
  return createToast(`Zoom ${direction === "in" ? "In" : "Out"} (${zoomPercent})`);
}

export function createSubtitleScaleToast(
  direction: "increase" | "decrease",
  scale: number,
): ToastState {
  const scalePercent = formatPercent(scale * 100);
  const prefix = direction === "increase" ? "Increase Subtitle Size" : "Decrease Subtitle Size";
  return createToast(`${prefix} (${scalePercent})`);
}

export function createTrackToast(
  kind: TrackKind,
  tracks: MediaTrack[],
  selectedTrack: MediaTrack | undefined,
): ToastState {
  if (kind === "audio") {
    const counter = getTrackCounter(tracks, selectedTrack);
    return createToast(
      `Audio: ${getTrackLabel(selectedTrack, "No audio")}${counter ? ` ${counter}` : ""}`,
    );
  }

  const counter = getTrackCounter(tracks, selectedTrack);
  return createToast(`Subtitles: ${getTrackLabel(selectedTrack, "Off")}${counter ? ` ${counter}` : ""}`);
}
