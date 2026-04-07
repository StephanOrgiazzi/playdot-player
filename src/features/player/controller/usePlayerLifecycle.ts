import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { getStartupMediaSource } from "@features/mediaOpen/startup";
import type { Window } from "@tauri-apps/api/window";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/error";
import { resetPlayerState, setPlayerState } from "../model/playerStore";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UsePlayerLifecycleOptions = {
  player: MpvPlayer;
  appWindow: Window;
  setError: StateSetter<string>;
  syncWindowState: () => Promise<void>;
  beforeStart?: () => Promise<void>;
};

export function usePlayerLifecycle({
  player,
  appWindow,
  setError,
  syncWindowState,
  beforeStart,
}: UsePlayerLifecycleOptions): void {
  const beforeStartRef = useRef(beforeStart);

  useEffect(() => {
    beforeStartRef.current = beforeStart;
  }, [beforeStart]);

  useEffect(() => {
    let mounted = true;
    resetPlayerState();

    const setup = async (): Promise<void> => {
      const startupMediaSourcePromise = getStartupMediaSource();

      try {
        await beforeStartRef.current?.();
        await player.start();
      } catch (error) {
        if (!mounted) {
          return;
        }

        setError(getErrorMessage(error, "Failed to initialize mpv"));
        return;
      }

      try {
        const startupMediaSource = await startupMediaSourcePromise;
        if (!startupMediaSource) {
          return;
        }

        await player.loadFile(startupMediaSource);
        if (!mounted) {
          return;
        }

        setError("");
      } catch (error) {
        if (!mounted) {
          return;
        }

        setError(getErrorMessage(error, "Failed to open launch media"));
      }
    };

    void setup();
    const unsub = player.subscribe((next) => {
      if (!mounted) {
        return;
      }

      setPlayerState(next);
    });

    const dragPromise = appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop") {
        return;
      }

      const [path] = event.payload.paths;
      if (!path) {
        return;
      }

      try {
        await player.loadFile(path);
        setError("");
      } catch (error) {
        setError(getErrorMessage(error, "Failed to play dropped file"));
      }
    });

    const resizePromise = appWindow.onResized(() => {
      void syncWindowState();
    });

    void syncWindowState();

    return () => {
      mounted = false;
      unsub();
      resetPlayerState();
      void dragPromise.then((unlisten) =>{  unlisten(); });
      void resizePromise.then((unlisten) =>{  unlisten(); });
      void player.stop();
    };
  }, [appWindow, player, setError, syncWindowState]);
}
