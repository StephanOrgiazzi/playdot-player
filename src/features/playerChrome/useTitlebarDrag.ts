import { useEffect, type RefObject } from "react";
import { Effect, Schema } from "effect";
import type { Window } from "@tauri-apps/api/window";
import type { TitlebarPointerDownRef } from "./types";

class TitlebarDragError extends Schema.TaggedErrorClass<TitlebarDragError>()("Titlebar.DragError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Failed to start titlebar drag";
  }
}

const startTitlebarDrag = Effect.fn("Titlebar.startDragging")(
  (appWindow: Window): Effect.Effect<void, TitlebarDragError> =>
    Effect.tryPromise({
      try: () => appWindow.startDragging(),
      catch: (cause) => new TitlebarDragError({ cause }),
    }),
);

type UseTitlebarDragOptions = {
  appWindow: Window;
  titlebarPointerDownRef: TitlebarPointerDownRef;
  suppressTitlePillClickRef: RefObject<boolean>;
};

export function useTitlebarDrag({
  appWindow,
  titlebarPointerDownRef,
  suppressTitlePillClickRef,
}: UseTitlebarDragOptions): void {
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      const pointerDown = titlebarPointerDownRef.current;
      if (!pointerDown) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        titlebarPointerDownRef.current = null;
        return;
      }

      const distanceX = Math.abs(event.clientX - pointerDown.x);
      const distanceY = Math.abs(event.clientY - pointerDown.y);
      if (Math.max(distanceX, distanceY) < 4) {
        return;
      }

      titlebarPointerDownRef.current = null;

      if (pointerDown.startedOnTitlePill) {
        suppressTitlePillClickRef.current = true;
      }

      Effect.runCallback(
        startTitlebarDrag(appWindow).pipe(
          Effect.catch((error) => Effect.logError("Titlebar.drag_failed", error)),
        ),
      );
    };

    const handleMouseUp = (): void => {
      titlebarPointerDownRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [appWindow, suppressTitlePillClickRef, titlebarPointerDownRef]);
}
