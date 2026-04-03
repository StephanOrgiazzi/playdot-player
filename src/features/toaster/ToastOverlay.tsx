import type { ToastState } from "./types";

type ToastOverlayProps = {
  toast: ToastState | null;
};

export function ToastOverlay({ toast }: ToastOverlayProps) {
  if (!toast) {
    return null;
  }

  return (
    <p className={`track-toast${toast.visible ? " is-visible" : ""}`} role="status" aria-live="polite">
      {toast.message}
    </p>
  );
}
