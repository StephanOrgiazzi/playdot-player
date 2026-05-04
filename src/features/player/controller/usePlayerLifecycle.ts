import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { getStartupMediaSource } from "@features/mediaOpen/startup";
import { listen } from "@tauri-apps/api/event";
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

    const loadMediaSource = async (source: string, fallbackMessage: string): Promise<void> => {
      try {
        await player.loadFile(source);
        if (!mounted) {
          return;
        }

        setError("");
      } catch (error) {
        if (!mounted) {
          return;
        }

        setError(getErrorMessage(error, fallbackMessage));
      }
    };

    const playerReadyPromise = (async (): Promise<void> => {
      try {
        await beforeStartRef.current?.();
        await player.start();
      } catch (error) {
        setError(getErrorMessage(error, "Failed to initialize mpv"));
        throw error;
      }
    })();

    const setup = async (): Promise<void> => {
      const startupMediaSourcePromise = getStartupMediaSource();

      try {
        await playerReadyPromise;
      } catch {
        return;
      }

      try {
        const startupMediaSource = await startupMediaSourcePromise;
        if (!startupMediaSource) {
          return;
        }

        await loadMediaSource(startupMediaSource, "Failed to open launch media");
      } catch {
        return;
      }
    };

    void setup();
    let autoCloseStarted = false;
    const unsub = player.subscribe((next) => {
      if (!mounted) {
        return;
      }

      setPlayerState(next);
      if (!autoCloseStarted && next.filename && next.eofReached) {
        autoCloseStarted = true;
        void appWindow.close();
      }
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
    const openMediaSourcePromise = listen<string>("open-media-source", (event) => {
      void playerReadyPromise
        .then(() => loadMediaSource(event.payload, "Failed to open launch media"))
        .catch(() => undefined);
    });

    void syncWindowState();

    return () => {
      mounted = false;
      unsub();
      resetPlayerState();
      void dragPromise.then((unlisten) => {
        unlisten();
      });
      void resizePromise.then((unlisten) => {
        unlisten();
      });
      void openMediaSourcePromise.then((unlisten) => {
        unlisten();
      });
      void player.stop();
    };
  }, [appWindow, player, setError, syncWindowState]);
}
