import { useEffect, useRef } from "react";
import { setVideoMarginRatio, type VideoMarginRatio } from "@integrations/mpv/libmpv-api";

type VideoViewportProps = {
  initialized: boolean;
  onDoubleClick?: () => void;
};

const EMPTY_RATIO: Required<VideoMarginRatio> = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0
};

export function VideoViewport({
  initialized,
  onDoubleClick,
}: VideoViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousRatioRef = useRef<Required<VideoMarginRatio>>(EMPTY_RATIO);

  useEffect(() => {
    const element = viewportRef.current;

    if (!element || !initialized) {
      return;
    }

    let frameId = 0;
    let hasAppliedInitialRatio = false;

    const normalizeRatio = (value: number): number => {
      const clamped = Math.min(1, Math.max(0, value));
      return Math.round(clamped * 1_000_000) / 1_000_000;
    };

    const getLayoutRect = (node: HTMLElement): { left: number; right: number; top: number; bottom: number } => {
      let left = 0;
      let top = 0;
      let current: HTMLElement | null = node;

      while (current) {
        left += current.offsetLeft;
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }

      const width = node.offsetWidth;
      const height = node.offsetHeight;
      return {
        left,
        right: left + width,
        top,
        bottom: top + height
      };
    };

    const updateRatio = async (): Promise<void> => {
      const rect = getLayoutRect(element);
      const viewportWidth = Math.max(1, window.innerWidth);
      const viewportHeight = Math.max(1, window.innerHeight);
      const nextRatio: Required<VideoMarginRatio> = {
        left: normalizeRatio(rect.left / viewportWidth),
        right: normalizeRatio(1 - rect.right / viewportWidth),
        top: normalizeRatio(rect.top / viewportHeight),
        bottom: normalizeRatio(1 - rect.bottom / viewportHeight)
      };

      if (!hasAppliedInitialRatio) {
        await setVideoMarginRatio(nextRatio);
        previousRatioRef.current = nextRatio;
        hasAppliedInitialRatio = true;
        return;
      }

      const changedRatio: VideoMarginRatio = {};

      if (nextRatio.left !== previousRatioRef.current.left) {
        changedRatio.left = nextRatio.left;
      }
      if (nextRatio.right !== previousRatioRef.current.right) {
        changedRatio.right = nextRatio.right;
      }
      if (nextRatio.top !== previousRatioRef.current.top) {
        changedRatio.top = nextRatio.top;
      }
      if (nextRatio.bottom !== previousRatioRef.current.bottom) {
        changedRatio.bottom = nextRatio.bottom;
      }

      if (Object.keys(changedRatio).length > 0) {
        await setVideoMarginRatio(changedRatio);
        previousRatioRef.current = nextRatio;
      }
    };

    const requestUpdate = (): void => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        void updateRatio();
      });
    };

    const resizeObserver = new ResizeObserver(requestUpdate);
    resizeObserver.observe(element);
    window.addEventListener("resize", requestUpdate);
    requestUpdate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", requestUpdate);
      previousRatioRef.current = EMPTY_RATIO;
      void setVideoMarginRatio(EMPTY_RATIO);
    };
  }, [initialized]);

  return <div ref={viewportRef} className="video-viewport" aria-hidden="true" onDoubleClick={onDoubleClick} />;
}
