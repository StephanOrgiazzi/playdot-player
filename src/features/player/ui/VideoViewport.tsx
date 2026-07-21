import { useEffect, useRef } from "react";
import { Effect, Queue, Schedule, Schema, Stream } from "effect";
import { setVideoMarginRatio, type VideoMarginRatio } from "@integrations/mpv/libmpv-api";

type VideoViewportProps = {
  initialized: boolean;
  onDoubleClick?: () => void;
};

const EMPTY_RATIO: Required<VideoMarginRatio> = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

class VideoViewportError extends Schema.TaggedErrorClass<VideoViewportError>()(
  "VideoViewport.MarginUpdateError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Failed to update video viewport margins";
  }
}

const applyVideoMarginRatio = Effect.fn("VideoViewport.applyMarginRatio")(
  (ratio: VideoMarginRatio): Effect.Effect<void, VideoViewportError> =>
    Effect.tryPromise({
      try: () => setVideoMarginRatio(ratio),
      catch: (cause) => new VideoViewportError({ cause }),
    }),
);

const marginUpdates = Effect.runSync(Queue.sliding<Required<VideoMarginRatio>>(1));
let marginWorkerStarted = false;

function enqueueVideoMarginRatio(ratio: Required<VideoMarginRatio>): void {
  if (!marginWorkerStarted) {
    marginWorkerStarted = true;
    const worker = Stream.fromQueue(marginUpdates).pipe(
      Stream.runForEach((ratio) =>
        applyVideoMarginRatio(ratio).pipe(
          Effect.retry(Schedule.recurs(2)),
          Effect.catch((error) => Effect.logError("VideoViewport.margin_update_failed", error)),
        ),
      ),
    );
    Effect.runCallback(worker);
  }

  Effect.runSync(Queue.offer(marginUpdates, ratio));
}

export function VideoViewport({ initialized, onDoubleClick }: VideoViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = viewportRef.current;

    if (!element || !initialized) {
      return;
    }

    let frameId = 0;

    const normalizeRatio = (value: number): number => {
      const clamped = Math.min(1, Math.max(0, value));
      return Math.round(clamped * 1_000_000) / 1_000_000;
    };

    const getLayoutRect = (
      node: HTMLElement,
    ): { left: number; right: number; top: number; bottom: number } => {
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
        bottom: top + height,
      };
    };

    const updateRatio = (): void => {
      const rect = getLayoutRect(element);
      const viewportWidth = Math.max(1, window.innerWidth);
      const viewportHeight = Math.max(1, window.innerHeight);
      const nextRatio: Required<VideoMarginRatio> = {
        left: normalizeRatio(rect.left / viewportWidth),
        right: normalizeRatio(1 - rect.right / viewportWidth),
        top: normalizeRatio(rect.top / viewportHeight),
        bottom: normalizeRatio(1 - rect.bottom / viewportHeight),
      };

      enqueueVideoMarginRatio(nextRatio);
    };

    const requestUpdate = (): void => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        updateRatio();
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
      enqueueVideoMarginRatio(EMPTY_RATIO);
    };
  }, [initialized]);

  return (
    <div
      ref={viewportRef}
      className="video-viewport"
      aria-hidden="true"
      onDoubleClick={onDoubleClick}
    />
  );
}
