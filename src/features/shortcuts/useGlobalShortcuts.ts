import { useEffect, useEffectEvent } from "react";
import { handleShortcutKeyDown, handleShortcutPaste, handleShortcutWheel } from "./handlers";
import type { UseGlobalShortcutsOptions } from "./types";

export function useGlobalShortcuts({
  cycleAudioTrack,
  cycleSubtitleTrack,
  closeWindow,
  adjustVolume,
  zoomIn,
  zoomOut,
  increaseSubtitleScale,
  decreaseSubtitleScale,
  hasMedia,
  isFullscreen,
  openPastedWebUrl,
  seekBack,
  seekForward,
  slowDownPlayback,
  speedUpPlayback,
  toggleFsr,
  toggleFullscreen,
  toggleMute,
  togglePlayPause,
}: UseGlobalShortcutsOptions): void {
  const handleKeyDown = useEffectEvent(
    (event: KeyboardEvent, priorityOnly = false): void => {
      const actions = {
        cycleAudioTrack,
        cycleSubtitleTrack,
        closeWindow,
        adjustVolume,
        zoomIn,
        zoomOut,
        increaseSubtitleScale,
        decreaseSubtitleScale,
        openPastedWebUrl,
        seekBack,
        seekForward,
        slowDownPlayback,
        speedUpPlayback,
        toggleFsr,
        toggleFullscreen,
        toggleMute,
        togglePlayPause,
      };

      handleShortcutKeyDown({ event, hasMedia, isFullscreen, actions, priorityOnly });
    },
  );
  const handleWheel = useEffectEvent((event: WheelEvent): void => {
    handleShortcutWheel({ event, hasMedia, adjustVolume });
  });
  const handlePaste = useEffectEvent((event: ClipboardEvent): void => {
    handleShortcutPaste({ event, openPastedWebUrl });
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      handleKeyDown(event);
    };
    const handlePriorityKeyDown = (event: KeyboardEvent): void => {
      handleKeyDown(event, true);
    };

    window.addEventListener("keydown", handlePriorityKeyDown, { capture: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handlePriorityKeyDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);
}
