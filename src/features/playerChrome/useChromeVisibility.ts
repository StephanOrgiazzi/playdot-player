import { useEffect, useRef, useState } from "react";
import { CHROME_HIDE_DELAY_MS } from "./constants";

export function useChromeVisibility(hasMedia: boolean, isControlDockHovered: boolean): boolean {
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const hideChromeTimeoutRef = useRef<number | null>(null);
  const hasMediaRef = useRef(false);
  const isControlDockHoveredRef = useRef(false);
  const isChromeVisibleRef = useRef(true);

  useEffect(() => {
    hasMediaRef.current = hasMedia;
  }, [hasMedia]);

  useEffect(() => {
    isControlDockHoveredRef.current = isControlDockHovered;
  }, [isControlDockHovered]);

  useEffect(() => {
    isChromeVisibleRef.current = isChromeVisible;
  }, [isChromeVisible]);

  const setChromeVisible = (nextVisible: boolean): void => {
    if (isChromeVisibleRef.current === nextVisible) {
      return;
    }

    isChromeVisibleRef.current = nextVisible;
    setIsChromeVisible(nextVisible);
  };

  const clearHideChromeTimeout = (): void => {
    if (hideChromeTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(hideChromeTimeoutRef.current);
    hideChromeTimeoutRef.current = null;
  };

  const scheduleHideChrome = (): void => {
    clearHideChromeTimeout();

    if (!hasMedia || isControlDockHovered) {
      return;
    }

    hideChromeTimeoutRef.current = window.setTimeout(() => {
      if (hasMediaRef.current && !isControlDockHoveredRef.current) {
        setChromeVisible(false);
      }
    }, CHROME_HIDE_DELAY_MS);
  };

  const revealChrome = (): void => {
    setChromeVisible(true);
    clearHideChromeTimeout();

    if (isControlDockHoveredRef.current) {
      return;
    }

    hideChromeTimeoutRef.current = window.setTimeout(() => {
      if (hasMediaRef.current && !isControlDockHoveredRef.current) {
        setChromeVisible(false);
      }
    }, CHROME_HIDE_DELAY_MS);
  };

  useEffect(() => {
    if (!hasMedia) {
      setChromeVisible(true);
      clearHideChromeTimeout();
      return clearHideChromeTimeout;
    }

    setChromeVisible(true);
    scheduleHideChrome();

    return clearHideChromeTimeout;
  }, [hasMedia, isControlDockHovered]);

  useEffect(() => {
    if (!hasMedia) {
      return;
    }

    const handleMouseMove = (): void => {
      revealChrome();
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearHideChromeTimeout();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [hasMedia]);

  return isChromeVisible;
}
