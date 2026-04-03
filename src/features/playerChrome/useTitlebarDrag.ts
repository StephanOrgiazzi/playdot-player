import { useEffect, type RefObject } from "react";
import type { Window } from "@tauri-apps/api/window";
import type { TitlebarPointerDownRef } from "./types";

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

      void appWindow.startDragging();
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
