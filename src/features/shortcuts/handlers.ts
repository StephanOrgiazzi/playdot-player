import type { ShortcutActions } from "./types";
import { isShortcutTargetEditable, normalizeWheelDelta, VOLUME_STEP } from "./utils";

type HandleShortcutKeyDownOptions = {
  event: KeyboardEvent;
  hasMedia: boolean;
  isFullscreen: boolean;
  actions: ShortcutActions;
  priorityOnly?: boolean;
};

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.key === " " || event.key === "Spacebar" || event.code === "Space";
}

export function handleShortcutKeyDown({
  event,
  hasMedia,
  isFullscreen,
  actions,
  priorityOnly = false,
}: HandleShortcutKeyDownOptions): void {
  if (event.defaultPrevented || isShortcutTargetEditable(event.target)) {
    return;
  }

  if (!priorityOnly) {
    const isCloseShortcut =
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      (event.key.toLowerCase() === "q" || event.key.toLowerCase() === "w");
    if (isCloseShortcut) {
      event.preventDefault();
      void actions.closeWindow();
      return;
    }

    if (event.ctrlKey && !event.altKey && !event.metaKey && hasMedia) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void actions.slowDownPlayback();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void actions.speedUpPlayback();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        void actions.increaseSubtitleScale();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        void actions.decreaseSubtitleScale();
        return;
      }

      const isZoomIn =
        event.key === "+" || event.key === "=" || event.code === "NumpadAdd" || event.code === "Equal";
      if (isZoomIn) {
        event.preventDefault();
        void actions.zoomIn();
        return;
      }

      const isZoomOut = event.key === "-" || event.key === "_" || event.code === "NumpadSubtract";
      if (isZoomOut) {
        event.preventDefault();
        void actions.zoomOut();
        return;
      }
    }
  }

  if (event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key === "Escape" && isFullscreen) {
    event.preventDefault();
    void actions.toggleFullscreen();
    return;
  }

  if (event.altKey && event.key === "Enter") {
    event.preventDefault();
    void actions.toggleFullscreen();
    return;
  }

  if (event.altKey) {
    return;
  }

  if (isSpaceKey(event)) {
    if (!hasMedia) {
      return;
    }

    event.preventDefault();
    void actions.togglePlayPause();
    return;
  }

  if (!hasMedia) {
    return;
  }

  if (!priorityOnly) {
    const normalizedKey = event.key.toLowerCase();
    if (normalizedKey === "a") {
      event.preventDefault();
      void actions.cycleAudioTrack();
      return;
    }

    if (normalizedKey === "s") {
      event.preventDefault();
      void actions.cycleSubtitleTrack();
      return;
    }

    if (normalizedKey === "u") {
      event.preventDefault();
      void actions.toggleFsr();
      return;
    }

    if (normalizedKey === "m") {
      event.preventDefault();
      void actions.toggleMute();
      return;
    }
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    void actions.seekBack();
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    void actions.seekForward();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    void actions.adjustVolume(VOLUME_STEP);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    void actions.adjustVolume(-VOLUME_STEP);
  }
}

type HandleShortcutWheelOptions = {
  event: WheelEvent;
  hasMedia: boolean;
  adjustVolume: (delta: number) => Promise<void>;
};

export function handleShortcutWheel({ event, hasMedia, adjustVolume }: HandleShortcutWheelOptions): void {
  if (!hasMedia || event.defaultPrevented || event.ctrlKey) {
    return;
  }

  if (isShortcutTargetEditable(event.target) || event.deltaY === 0) {
    return;
  }

  const normalizedDelta = normalizeWheelDelta(event);
  const volumeDelta = Math.max(-20, Math.min(20, -normalizedDelta / 20));
  if (volumeDelta === 0) {
    return;
  }

  event.preventDefault();
  void adjustVolume(volumeDelta);
}

type HandleShortcutPasteOptions = {
  event: ClipboardEvent;
  openPastedWebUrl: (clipboardText: string) => Promise<void>;
};

export function handleShortcutPaste({ event, openPastedWebUrl }: HandleShortcutPasteOptions): void {
  if (event.defaultPrevented || isShortcutTargetEditable(event.target)) {
    return;
  }

  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  if (clipboardText.trim().length === 0) {
    return;
  }

  void openPastedWebUrl(clipboardText);
}
