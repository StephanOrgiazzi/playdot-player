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

type KeyShortcutAction = Exclude<keyof ShortcutActions, "adjustVolume" | "adjustGamma" | "openPastedWebUrl">;

const CTRL_MEDIA_SHORTCUTS: Partial<Record<string, KeyShortcutAction>> = {
  ArrowLeft: "slowDownPlayback",
  ArrowRight: "speedUpPlayback",
  ArrowUp: "increaseSubtitleScale",
  ArrowDown: "decreaseSubtitleScale",
};

const MEDIA_SHORTCUTS: Partial<Record<string, KeyShortcutAction>> = {
  a: "cycleAudioTrack",
  s: "cycleSubtitleTrack",
  u: "toggleFsr",
  m: "toggleMute",
};

function getZoomShortcutAction(event: KeyboardEvent): KeyShortcutAction | undefined {
  if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd" || event.code === "Equal") {
    return "zoomIn";
  }

  if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") {
    return "zoomOut";
  }

  return undefined;
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

  const runShortcut = (action: KeyShortcutAction): void => {
    event.preventDefault();
    void actions[action]();
  };
  const adjustVolume = (delta: number): void => {
    event.preventDefault();
    void actions.adjustVolume(delta);
  };
  const normalizedKey = event.key.toLowerCase();
  const hasCtrlShortcutModifiers = event.ctrlKey && !event.altKey && !event.metaKey;

  if (!priorityOnly) {
    if (hasCtrlShortcutModifiers && (normalizedKey === "q" || normalizedKey === "w")) {
      runShortcut("closeWindow");
      return;
    }

    if (hasMedia && hasCtrlShortcutModifiers) {
      const action = CTRL_MEDIA_SHORTCUTS[event.key] ?? getZoomShortcutAction(event);
      if (action) {
        runShortcut(action);
        return;
      }
    }
  }

  if (event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key === "Escape" && isFullscreen) {
    runShortcut("toggleFullscreen");
    return;
  }

  if (event.altKey && event.key === "Enter") {
    runShortcut("toggleFullscreen");
    return;
  }

  if (event.altKey) {
    if (!hasMedia) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      void actions.adjustGamma(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      void actions.adjustGamma(1);
      return;
    }

    return;
  }

  if (isSpaceKey(event)) {
    if (!hasMedia) {
      return;
    }

    runShortcut("togglePlayPause");
    return;
  }

  if (!hasMedia) {
    return;
  }

  if (!priorityOnly) {
    const action = MEDIA_SHORTCUTS[normalizedKey];
    if (action) {
      runShortcut(action);
      return;
    }
  }

  switch (event.key) {
    case "ArrowLeft":
      runShortcut("seekBack");
      return;
    case "ArrowRight":
      runShortcut("seekForward");
      return;
    case "ArrowUp":
      adjustVolume(VOLUME_STEP);
      return;
    case "ArrowDown":
      adjustVolume(-VOLUME_STEP);
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
