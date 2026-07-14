import { useCallback, useRef, useSyncExternalStore } from "react";
import { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import type { PlayerState } from "../model/playerState";

type PlayerStateSelector<T> = (state: PlayerState) => T;
type EqualityCheck<T> = (left: T, right: T) => boolean;

export const player = new MpvPlayer();

export function usePlayerStateSelector<T>(
  selector: PlayerStateSelector<T>,
  isEqual: EqualityCheck<T> = Object.is,
): T {
  const selectedStateRef = useRef(selector(player.getSnapshot()));
  const latestSelectedState = selector(player.getSnapshot());

  if (!isEqual(selectedStateRef.current, latestSelectedState)) {
    selectedStateRef.current = latestSelectedState;
  }

  const getSnapshot = useCallback(() => selectedStateRef.current, []);
  const subscribe = useCallback(
    (notify: () => void) =>
      player.subscribe((state) => {
        const nextSelectedState = selector(state);
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
