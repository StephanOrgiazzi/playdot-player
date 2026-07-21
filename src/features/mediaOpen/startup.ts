import { invoke } from "@tauri-apps/api/core";
import { Schema } from "effect";

const StartupMediaSource = Schema.NullOr(Schema.String);

let startupMediaSourcePromise: Promise<string | null> | null = null;

async function readStartupMediaSource(): Promise<string | null> {
  const payload = await invoke<string | null>("get_startup_media_argument");
  return Schema.decodeUnknownPromise(StartupMediaSource)(payload);
}

export async function getStartupMediaSource(): Promise<string | null> {
  startupMediaSourcePromise ??= readStartupMediaSource();
  return startupMediaSourcePromise;
}
