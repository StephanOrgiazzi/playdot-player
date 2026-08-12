import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatTime } from "@shared/lib/format";
import type { PlayerControlsProps } from "../model/types";

const POINTER_NATIVE_CHANGE_BLOCK_MS = 80;

export type TimelinePreview = {
  leftPercent: number;
  time: string;
};

type PendingTimelinePointer = {
  value: number;
  leftPercent: number;
  scrubbing: boolean;
};

type UseTimelineControlArgs = Pick<
  PlayerControlsProps,
  | "hasMedia"
  | "setTimelinePosition"
  | "requestTimelineThumbnail"
  | "clearTimelineThumbnail"
  | "subscribeTimelineThumbnail"
> & {
  duration: number;
  timePos: number;
};

export type TimelineControl = {
  displayedCurrentTime: string;
  isTimelineScrubbing: boolean;
  timelinePreview: TimelinePreview | null;
  timelineProgressPercent: string;
  timelineValue: number;
  progressMax: number;
  thumbnailUrl: string;
  clearTimelinePreview: () => void;
  handleTimelineChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleTimelinePointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  handleTimelinePointerMove: (event: ReactPointerEvent<HTMLInputElement>) => void;
};

function getTimelinePointerMetrics(
  element: HTMLInputElement,
  clientX: number,
): { ratio: number; leftPercent: number } {
  const trackBounds = element.getBoundingClientRect();
  if (trackBounds.width <= 0) {
    return { ratio: 0, leftPercent: 0 };
  }

  const clampedX = Math.min(trackBounds.right, Math.max(trackBounds.left, clientX));
  const ratio = (clampedX - trackBounds.left) / trackBounds.width;
  return {
    ratio: Math.min(1, Math.max(0, ratio)),
    leftPercent: ratio * 100,
  };
}

function useTimelinePointerScheduler(apply: (pending: PendingTimelinePointer) => void): {
  cancel: () => void;
  flush: () => void;
  schedule: (pending: PendingTimelinePointer) => void;
} {
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingTimelinePointer | null>(null);

  const cancel = useCallback((): void => {
    pendingRef.current = null;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const flush = useCallback((): void => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      apply(pending);
    }
  }, [apply]);

  const schedule = useCallback(
    (pending: PendingTimelinePointer): void => {
      pendingRef.current = pending;
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const latest = pendingRef.current;
        pendingRef.current = null;
        if (latest) {
          apply(latest);
        }
      });
    },
    [apply],
  );

  useEffect(() => cancel, [cancel]);
  return { cancel, flush, schedule };
}

export function useTimelineControl({
  duration,
  hasMedia,
  setTimelinePosition,
  requestTimelineThumbnail,
  clearTimelineThumbnail,
  subscribeTimelineThumbnail,
  timePos,
}: UseTimelineControlArgs): TimelineControl {
  const [timelineHoverPreview, setTimelineHoverPreview] = useState<TimelinePreview | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isTimelineScrubbing, setIsTimelineScrubbing] = useState(false);
  const [timelineDragValue, setTimelineDragValue] = useState<number | null>(null);
  const timelineDragValueRef = useRef<number | null>(null);
  const isTimelinePointerScrubbingRef = useRef(false);
  const ignoreNativeTimelineChangeRef = useRef(false);
  const nativeTimelineChangeTimerRef = useRef<number | null>(null);
  const progressMax = duration > 0 ? duration : 1;
  const progressPercent =
    duration > 0 ? `${(Math.min(timePos, progressMax) / progressMax) * 100}%` : "0%";

  const getClampedTimelineValue = useCallback(
    (value: number): number => Math.min(Math.max(0, value), progressMax),
    [progressMax],
  );
  const setTimelineDragState = useCallback((value: number | null): void => {
    timelineDragValueRef.current = value;
    setTimelineDragValue(value);
  }, []);
  const setTimelineScrubbingState = useCallback((value: boolean): void => {
    isTimelinePointerScrubbingRef.current = value;
    setIsTimelineScrubbing(value);
  }, []);
  const createTimelinePreview = useCallback(
    (value: number): TimelinePreview => {
      const clampedValue = getClampedTimelineValue(value);
      return {
        leftPercent: progressMax > 0 ? (clampedValue / progressMax) * 100 : 0,
        time: formatTime(duration > 0 ? clampedValue : null),
      };
    },
    [duration, getClampedTimelineValue, progressMax],
  );
  const applyTimelinePointer = useCallback(
    ({ value, leftPercent, scrubbing }: PendingTimelinePointer): void => {
      if (scrubbing) {
        setTimelineDragState(value);
      } else {
        setTimelineHoverPreview({ ...createTimelinePreview(value), leftPercent });
      }
      requestTimelineThumbnail(value);
    },
    [createTimelinePreview, requestTimelineThumbnail, setTimelineDragState],
  );
  const {
    cancel: cancelScheduledPointer,
    flush: flushScheduledPointer,
    schedule: schedulePointer,
  } = useTimelinePointerScheduler(applyTimelinePointer);

  const ignoreNativeTimelineChangesBriefly = useCallback((): void => {
    ignoreNativeTimelineChangeRef.current = true;
    if (nativeTimelineChangeTimerRef.current !== null) {
      window.clearTimeout(nativeTimelineChangeTimerRef.current);
    }
    nativeTimelineChangeTimerRef.current = window.setTimeout(() => {
      ignoreNativeTimelineChangeRef.current = false;
      nativeTimelineChangeTimerRef.current = null;
    }, POINTER_NATIVE_CHANGE_BLOCK_MS);
  }, []);
  const clearTimelinePreview = useCallback((): void => {
    cancelScheduledPointer();
    setTimelineHoverPreview(null);
    clearTimelineThumbnail();
  }, [cancelScheduledPointer, clearTimelineThumbnail]);
  const commitTimelineScrub = useCallback((): void => {
    flushScheduledPointer();
    ignoreNativeTimelineChangesBriefly();
    setTimelineScrubbingState(false);
    const nextValue = timelineDragValueRef.current;
    if (nextValue !== null) {
      setTimelinePosition(nextValue);
    }
  }, [
    flushScheduledPointer,
    ignoreNativeTimelineChangesBriefly,
    setTimelinePosition,
    setTimelineScrubbingState,
  ]);
  const handleTimelinePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      cancelScheduledPointer();
      const { ratio, leftPercent } = getTimelinePointerMetrics(event.currentTarget, event.clientX);
      const value = getClampedTimelineValue(ratio * progressMax);
      setTimelineScrubbingState(true);
      applyTimelinePointer({ value, leftPercent, scrubbing: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      applyTimelinePointer,
      cancelScheduledPointer,
      getClampedTimelineValue,
      hasMedia,
      progressMax,
      setTimelineScrubbingState,
    ],
  );
  const handleTimelinePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }
      const { ratio, leftPercent } = getTimelinePointerMetrics(event.currentTarget, event.clientX);
      schedulePointer({
        value: getClampedTimelineValue(ratio * progressMax),
        leftPercent,
        scrubbing: isTimelinePointerScrubbingRef.current,
      });
    },
    [getClampedTimelineValue, hasMedia, progressMax, schedulePointer],
  );
  const handleTimelineChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      if (
        !hasMedia ||
        isTimelinePointerScrubbingRef.current ||
        ignoreNativeTimelineChangeRef.current
      ) {
        return;
      }
      const value = getClampedTimelineValue(Number(event.currentTarget.value));
      setTimelineDragState(value);
      setTimelinePosition(value);
    },
    [getClampedTimelineValue, hasMedia, setTimelineDragState, setTimelinePosition],
  );

  useEffect(() => {
    if (!isTimelineScrubbing) {
      return;
    }
    const handlePointerUp = (): void => {
      commitTimelineScrub();
    };
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [commitTimelineScrub, isTimelineScrubbing]);

  useEffect(() => {
    if (
      timelineDragValue !== null &&
      !isTimelineScrubbing &&
      Math.abs(timePos - timelineDragValue) <= 0.25
    ) {
      setTimelineDragState(null);
    }
  }, [isTimelineScrubbing, setTimelineDragState, timePos, timelineDragValue]);

  useEffect(() => subscribeTimelineThumbnail(setThumbnailUrl), [subscribeTimelineThumbnail]);
  useEffect(
    () => () => {
      if (nativeTimelineChangeTimerRef.current !== null) {
        window.clearTimeout(nativeTimelineChangeTimerRef.current);
      }
    },
    [],
  );
  useEffect(() => {
    if (!hasMedia) {
      setTimelineScrubbingState(false);
      setTimelineDragState(null);
      clearTimelineThumbnail();
    }
  }, [clearTimelineThumbnail, hasMedia, setTimelineDragState, setTimelineScrubbingState]);

  const timelineValue = timelineDragValue ?? Math.min(timePos, progressMax);
  let timelineProgressPercent = progressPercent;
  if (timelineDragValue !== null) {
    timelineProgressPercent = progressMax > 0 ? `${(timelineValue / progressMax) * 100}%` : "0%";
  }
  return {
    displayedCurrentTime:
      timelineDragValue === null
        ? formatTime(timePos)
        : formatTime(duration > 0 ? timelineValue : null),
    isTimelineScrubbing,
    timelinePreview:
      timelineDragValue === null ? timelineHoverPreview : createTimelinePreview(timelineDragValue),
    timelineProgressPercent,
    timelineValue,
    progressMax,
    thumbnailUrl,
    clearTimelinePreview,
    handleTimelineChange,
    handleTimelinePointerDown,
    handleTimelinePointerMove,
  };
}
