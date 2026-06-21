import type { PlayerState } from "@features/player/model/playerState";

export function isPlaybackBlocked(
  state: Pick<PlayerState, "coreIdle" | "pausedForCache">,
): boolean {
  return state.pausedForCache || state.coreIdle;
}

export function getNextPauseForTransportToggle(
  state: Pick<PlayerState, "coreIdle" | "paused" | "pausedForCache">,
  confirmedPaused: boolean | null,
): boolean {
  if (isPlaybackBlocked(state)) {
    return false;
  }

  return !(confirmedPaused ?? state.paused);
}
