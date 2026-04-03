import { startTransition, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { getStartupMediaSource } from "@features/mediaOpen/startup";
import type { Window } from "@tauri-apps/api/window";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/error";
import type { PlayerState } from "../model/playerState";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UsePlayerLifecycleOptions = {
  player: MpvPlayer;
  appWindow: Window;
  setState: StateSetter<PlayerState>;
  setError: StateSetter<string>;
  syncWindowState: () => Promise<void>;
  beforeStart?: () => Promise<void>;
};

export function usePlayerLifecycle({
  player,
  appWindow,
  setState,
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

      startTransition(() => {
        setState((current) => (current === next ? current : next));
      });
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
      void dragPromise.then((unlisten) => unlisten());
      void resizePromise.then((unlisten) => unlisten());
      void player.stop();
    };
  }, [appWindow, player, setError, setState, syncWindowState]);
}
