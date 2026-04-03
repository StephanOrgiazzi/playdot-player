import { useEffect, useRef, useState } from "react";
import { CURSOR_HIDE_DELAY_MS } from "./constants";

export function useCursorVisibility(hasMedia: boolean, isControlDockHovered: boolean): boolean {
  const [isCursorHidden, setIsCursorHidden] = useState(false);
  const hideCursorTimeoutRef = useRef<number | null>(null);
  const hasMediaRef = useRef(false);
  const isControlDockHoveredRef = useRef(false);
  const isCursorHiddenRef = useRef(false);

  useEffect(() => {
    hasMediaRef.current = hasMedia;
  }, [hasMedia]);

  useEffect(() => {
    isControlDockHoveredRef.current = isControlDockHovered;
  }, [isControlDockHovered]);

  useEffect(() => {
    isCursorHiddenRef.current = isCursorHidden;
  }, [isCursorHidden]);

  const setCursorHidden = (nextHidden: boolean): void => {
    if (isCursorHiddenRef.current === nextHidden) {
      return;
    }

    isCursorHiddenRef.current = nextHidden;
    setIsCursorHidden(nextHidden);
  };

  const clearHideCursorTimeout = (): void => {
    if (hideCursorTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(hideCursorTimeoutRef.current);
    hideCursorTimeoutRef.current = null;
  };

  const scheduleCursorHide = (): void => {
    clearHideCursorTimeout();

    if (!hasMediaRef.current || isControlDockHoveredRef.current) {
      return;
    }

    hideCursorTimeoutRef.current = window.setTimeout(() => {
      if (hasMediaRef.current && !isControlDockHoveredRef.current) {
        setCursorHidden(true);
      }
    }, CURSOR_HIDE_DELAY_MS);
  };

  useEffect(() => {
    if (!hasMedia || isControlDockHovered) {
      setCursorHidden(false);
      clearHideCursorTimeout();
      return clearHideCursorTimeout;
    }

    setCursorHidden(false);
    scheduleCursorHide();

    return clearHideCursorTimeout;
  }, [hasMedia, isControlDockHovered]);

  useEffect(() => {
    if (!hasMedia) {
      return;
    }

    const handleMouseMove = (): void => {
      setCursorHidden(false);
      scheduleCursorHide();
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearHideCursorTimeout();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [hasMedia]);

  return isCursorHidden;
}
