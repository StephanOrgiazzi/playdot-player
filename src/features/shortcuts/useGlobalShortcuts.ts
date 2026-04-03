import { useEffect, useEffectEvent } from "react";
import { handleShortcutKeyDown, handleShortcutPaste, handleShortcutWheel } from "./handlers";
import type { UseGlobalShortcutsOptions } from "./types";

export function useGlobalShortcuts({ hasMedia, isFullscreen, ...actions }: UseGlobalShortcutsOptions): void {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent, priorityOnly = false): void => {
    handleShortcutKeyDown({ event, hasMedia, isFullscreen, actions, priorityOnly });
  });
  const handleWheel = useEffectEvent((event: WheelEvent): void => {
    handleShortcutWheel({ event, hasMedia, adjustVolume: actions.adjustVolume });
  });
  const handlePaste = useEffectEvent((event: ClipboardEvent): void => {
    handleShortcutPaste({ event, openPastedWebUrl: actions.openPastedWebUrl });
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => handleKeyDown(event);
    const onPriorityKeyDown = (event: KeyboardEvent): void => handleKeyDown(event, true);

    window.addEventListener("keydown", onPriorityKeyDown, { capture: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", onPriorityKeyDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);
}
