import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const AUDIO_FILE_EXTENSIONS = new Set([
  "aac",
  "aiff",
  "alac",
  "flac",
  "m4a",
  "mp3",
  "ogg",
  "opus",
  "wav",
  "wma",
]);
export const AUDIO_ARTWORK_HIDDEN_VIDEO_MARGIN_RATIO = {
  left: 0,
  right: 0,
  top: 1,
  bottom: 0,
} as const;

export function isLikelyAudioSource(source: string): boolean {
  if (/^https?:\/\//i.test(source)) {
    return false;
  }

  const normalizedSource = source.split(/[?#]/, 1)[0] ?? source;
  const extension = normalizedSource.match(/\.([^.\\/]+)$/)?.[1]?.toLowerCase();
  return extension ? AUDIO_FILE_EXTENSIONS.has(extension) : false;
}

export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

export async function readAudioArtworkUrl(source: string | null): Promise<string> {
  const path = await invoke<string | null>("extract_audio_artwork", { source });
  return path ? convertFileSrc(path) : "";
}
