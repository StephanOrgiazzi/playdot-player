import { useCallback, useRef, useSyncExternalStore } from "react";
import { EMPTY_PLAYER_STATE, type PlayerState } from "./playerState";

type PlayerStateListener = () => void;
type PlayerStateSelector<T> = (state: PlayerState) => T;
type EqualityCheck<T> = (left: T, right: T) => boolean;

const listeners = new Set<PlayerStateListener>();
let playerState: PlayerState = { ...EMPTY_PLAYER_STATE };

export function getPlayerState(): PlayerState {
  return playerState;
}

export function setPlayerState(nextState: PlayerState): void {
  if (nextState === playerState) {
    return;
  }

  playerState = nextState;
  for (const listener of listeners) {
    listener();
  }
}

export function resetPlayerState(): void {
  setPlayerState({ ...EMPTY_PLAYER_STATE });
}

function subscribePlayerState(listener: PlayerStateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayerStateSelector<T>(
  selector: PlayerStateSelector<T>,
  isEqual: EqualityCheck<T> = Object.is,
): T {
  const selectedStateRef = useRef(selector(getPlayerState()));
  const latestSelectedState = selector(getPlayerState());

  if (!isEqual(selectedStateRef.current, latestSelectedState)) {
    selectedStateRef.current = latestSelectedState;
  }

  const getSnapshot = useCallback(() => selectedStateRef.current, []);
  const subscribe = useCallback(
    (notify: () => void) =>
      subscribePlayerState(() => {
        const nextSelectedState = selector(getPlayerState());
        if (isEqual(selectedStateRef.current, nextSelectedState)) {
          return;
        }

        selectedStateRef.current = nextSelectedState;
        notify();
      }),
    [isEqual, selector],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
