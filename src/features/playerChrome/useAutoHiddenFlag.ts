import { useEffect, useEffectEvent, useRef, useState } from "react";

export function useAutoHiddenFlag({
  enabled,
  paused,
  delayMs,
}: {
  enabled: boolean;
  paused: boolean;
  delayMs: number;
}): boolean {
  const [isHidden, setIsHidden] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  const clearHideTimeout = useEffectEvent((): void => {
    if (hideTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = null;
  });
  const setHidden = useEffectEvent((nextHidden: boolean): void => {
    setIsHidden((current) => (current === nextHidden ? current : nextHidden));
  });
  const hideIfActive = useEffectEvent((): void => {
    if (!enabled || paused) {
      return;
    }

    setHidden(true);
  });
  const scheduleHide = useEffectEvent((): void => {
    clearHideTimeout();

    if (!enabled || paused) {
      return;
    }

    hideTimeoutRef.current = window.setTimeout(() => {
      hideIfActive();
    }, delayMs);
  });

  useEffect(() => {
    if (!enabled || paused) {
      setHidden(false);
      clearHideTimeout();
      return (): void => {
        clearHideTimeout();
      };
    }

    setHidden(false);
    scheduleHide();

    return (): void => {
      clearHideTimeout();
    };
  }, [delayMs, enabled, paused]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleMouseMove = (): void => {
      setHidden(false);
      scheduleHide();
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearHideTimeout();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [enabled]);

  return isHidden;
}
