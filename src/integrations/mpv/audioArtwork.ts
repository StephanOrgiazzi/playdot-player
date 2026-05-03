import { join, tempDir } from "@tauri-apps/api/path";
import type { MediaTrack } from "@features/player/model/playerState";

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
const ARTWORK_CAPTURE_DELAY_MS = 180;

export function isLikelyAudioSource(source: string): boolean {
  if (/^https?:\/\//i.test(source)) {
    return false;
  }

  const normalizedSource = source.split(/[?#]/, 1)[0] ?? source;
  const extension = normalizedSource.match(/\.([^.\\/]+)$/)?.[1]?.toLowerCase();
  return extension ? AUDIO_FILE_EXTENSIONS.has(extension) : false;
}

export function shouldShowAudioArtwork(tracks: MediaTrack[]): boolean {
  const hasAudio = tracks.some((track) => track.type === "audio");
  const videoTracks = tracks.filter((track) => track.type === "video");
  const hasArtworkVideo = videoTracks.some((track) => track.albumart);
  const hasRegularVideo = videoTracks.some((track) => !track.albumart);

  return hasAudio && hasArtworkVideo && !hasRegularVideo;
}

export async function createArtworkCapturePath(): Promise<string> {
  const directory = await tempDir();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return join(directory, `playdot-player-artwork-${suffix}.png`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export function waitForArtworkCaptureDelay(): Promise<void> {
  return delay(ARTWORK_CAPTURE_DELAY_MS);
}

export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}
