import { invoke } from "@tauri-apps/api/core";

let startupMediaSourcePromise: Promise<string | null> | null = null;

function readStartupMediaSource(): Promise<string | null> {
  return invoke<string | null>("get_startup_media_argument").catch(() => null);
}

export async function getStartupMediaSource(): Promise<string | null> {
  startupMediaSourcePromise ??= readStartupMediaSource();
  return startupMediaSourcePromise;
}
