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
export function isLikelyAudioSource(source: string): boolean {
  if (/^https?:\/\//i.test(source)) {
    return false;
  }

  const normalizedSource = source.split(/[?#]/, 1)[0] ?? source;
  const extension = /\.([^.\\/]+)$/.exec(normalizedSource)?.[1]?.toLowerCase();
  return extension ? AUDIO_FILE_EXTENSIONS.has(extension) : false;
}

export async function readAudioArtworkUrl(source: string | null): Promise<string> {
  const path = await invoke<string | null>("extract_audio_artwork", { source });
  return path ? convertFileSrc(path) : "";
}
