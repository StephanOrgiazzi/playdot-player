import { useCallback, useSyncExternalStore } from "react";
import { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import type { PlayerState } from "../model/playerState";

export const player = new MpvPlayer();

function subscribeToPlayer(notify: () => void): () => void {
  return player.subscribe(notify);
}

export function usePlayerState<Key extends keyof PlayerState>(key: Key): PlayerState[Key] {
  const getSnapshot = useCallback(() => player.getSnapshot()[key], [key]);
  return useSyncExternalStore(subscribeToPlayer, getSnapshot, getSnapshot);
}
