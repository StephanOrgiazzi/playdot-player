import type { PlayerState } from "@features/player/model/playerState";

type TransportState = Pick<PlayerState, "coreIdle" | "paused" | "pausedForCache">;

export function getNextPauseForTransportToggle(
  state: TransportState,
  confirmedPaused: boolean | null,
): boolean {
  if (state.coreIdle) {
    return false;
  }

  return !(confirmedPaused ?? state.paused);
}
