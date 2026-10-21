import { useCallback, useEffect, useRef, useState } from "react";
import { AudioBridgeController, readAudioBridgeStatus } from "@integrations/mpv/audioBridge";
import { playerCommand, runPlayerCommand } from "./playerCommand";

export function useAudioBridge(hasMedia: boolean) {
  const [controller] = useState(() => new AudioBridgeController());
  const [enabled, setEnabled] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState("");
  const switching = useRef(false);

  const toggle = useCallback((): void => {
    if (switching.current || (!hasMedia && !controller.enabled)) return;
    switching.current = true;
    setIsSwitching(true);
    runPlayerCommand(
      playerCommand("Failed to toggle Dolby Surround", async () => {
        try {
          if (controller.enabled) await controller.disable();
          else await controller.enable();
          setError("");
        } finally {
          setEnabled(controller.enabled);
          switching.current = false;
          setIsSwitching(false);
        }
      }),
      setError,
    );
  }, [controller, hasMedia]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (switching.current) return;
      switching.current = true;
      runPlayerCommand(
        playerCommand("The projector audio mirror stopped", async () => {
          try {
            const status = await readAudioBridgeStatus();
            if (!status.enabled) {
              await controller.disable();
              setEnabled(false);
              setError(status.error ?? "The projector audio mirror stopped.");
            }
          } finally {
            switching.current = false;
          }
        }),
        setError,
      );
    }, 2000);
    return () => window.clearInterval(timer);
  }, [controller, enabled]);

  useEffect(
    () => () => {
      runPlayerCommand(
        playerCommand("Failed to stop the projector audio mirror", () => controller.disable()),
        () => undefined,
      );
    },
    [controller],
  );

  return { enabled, isSwitching, error, toggle };
}
