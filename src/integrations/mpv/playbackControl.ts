import type { PlayerState } from "@features/player/model/playerState";
import { getMpvLoadOptionsForSource } from "./config";
import { SUBTITLE_SCALE } from "./constants";
import { command, getProperty, setProperty } from "./libmpv-api";

type TransportState = Pick<PlayerState, "paused">;
type PlayerFlag = "pause" | "mute";
type PlaybackRestart = { path: string; startSeconds: number };

export function getNextPauseForTransportToggle(
  state: TransportState,
  confirmedPaused: boolean | null,
): boolean {
  return !(confirmedPaused ?? state.paused);
}

export function readMpvFlag(name: PlayerFlag): Promise<boolean | null> {
  return getProperty(name, "flag").catch(() => null);
}

export async function setMpvFlag(name: PlayerFlag, value: boolean): Promise<boolean> {
  await setProperty(name, value);
  return (await readMpvFlag(name)) ?? value;
}

export async function loadMpvSource(path: string, startSeconds: number | null): Promise<void> {
  const sourceOptions = getMpvLoadOptionsForSource(path);
  const loadOptions =
    startSeconds === null ? sourceOptions : { ...sourceOptions, start: String(startSeconds) };
  await command("loadfile", loadOptions ? [path, "replace", -1, loadOptions] : [path]);
}

export async function resetMpvPerMediaDefaults(): Promise<void> {
  await Promise.all([setProperty("sub-scale", SUBTITLE_SCALE), setProperty("gamma", 1)]);
}

export async function readMpvPlaybackRestart(): Promise<PlaybackRestart | null> {
  if (!(await getProperty("eof-reached", "flag"))) {
    return null;
  }

  const [path, timePos, duration, seekable] = await Promise.all([
    getProperty("path", "string"),
    getProperty("time-pos", "double"),
    getProperty("duration", "double"),
    getProperty("seekable", "flag"),
  ]);
  if (!path) {
    return null;
  }

  const interruptedVideo =
    getMpvLoadOptionsForSource(path) !== null &&
    seekable === true &&
    timePos !== null &&
    duration !== null &&
    timePos > 0 &&
    duration - timePos > 2; // EOF can precede the reported duration by a few frames.

  return { path, startSeconds: interruptedVideo ? timePos : 0 };
}
