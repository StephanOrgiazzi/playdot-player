import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatTime } from "@shared/lib/format";
import type { PlayerControlsProps } from "../model/types";
import { ToolCluster, TransportCluster, VolumeCluster } from "./PlayerControlClusters";

type TimelinePreview = {
  leftPercent: number;
  time: string;
};

type UseTimelineControlArgs = Pick<
  PlayerControlsProps,
  "currentTime" | "hasMedia" | "progressMax" | "progressPercent" | "setTimelinePosition"
> & {
  duration: number;
  timePos: number;
};

type TimelineControl = {
  displayedCurrentTime: string;
  isTimelineScrubbing: boolean;
  timelinePreview: TimelinePreview | null;
  timelineProgressPercent: string;
  timelineValue: number;
  clearTimelinePreview: () => void;
  handleTimelineChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleTimelinePointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  handleTimelinePointerMove: (event: ReactPointerEvent<HTMLInputElement>) => void;
  updateTimelinePreview: (event: ReactMouseEvent<HTMLInputElement>) => void;
};

type TimelineRowProps = {
  displayedCurrentTime: string;
  totalTime: string;
  progressMax: number;
  timelineValue: number;
  timelineProgressPercent: string;
  isTimelineScrubbing: boolean;
  hasMedia: boolean;
  timelinePreview: TimelinePreview | null;
  clearTimelinePreview: () => void;
  handleTimelineChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleTimelinePointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  handleTimelinePointerMove: (event: ReactPointerEvent<HTMLInputElement>) => void;
  updateTimelinePreview: (event: ReactMouseEvent<HTMLInputElement>) => void;
};

function useTimelineControl({
  currentTime,
  duration,
  hasMedia,
  progressMax,
  progressPercent,
  setTimelinePosition,
  timePos,
}: UseTimelineControlArgs): TimelineControl {
  const [timelineHoverPreview, setTimelineHoverPreview] = useState<TimelinePreview | null>(null);
  const [isTimelineScrubbing, setIsTimelineScrubbing] = useState(false);
  const [timelineDragValue, setTimelineDragValue] = useState<number | null>(null);
  const timelineDragValueRef = useRef<number | null>(null);
  const isTimelinePointerScrubbingRef = useRef(false);

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

  const getTimelinePointerMetrics = useCallback(
    (
      element: HTMLInputElement,
      clientX: number,
    ): {
      ratio: number;
      leftPercent: number;
    } => {
      const trackBounds = element.getBoundingClientRect();
      if (trackBounds.width <= 0) {
        return { ratio: 0, leftPercent: 0 };
      }

      const clampedX = Math.min(trackBounds.right, Math.max(trackBounds.left, clientX));
      const ratio = (clampedX - trackBounds.left) / trackBounds.width;

      return {
        ratio: Math.min(1, Math.max(0, ratio)),
        leftPercent: ((clampedX - trackBounds.left) / trackBounds.width) * 100,
      };
    },
    [],
  );

  const getTimelineValueFromClientX = useCallback(
    (element: HTMLInputElement, clientX: number): number => {
      const { ratio } = getTimelinePointerMetrics(element, clientX);
      return getClampedTimelineValue(ratio * progressMax);
    },
    [getClampedTimelineValue, getTimelinePointerMetrics, progressMax],
  );

  const createTimelinePreview = useCallback(
    (value: number): TimelinePreview => {
      const clampedValue = getClampedTimelineValue(value);
      const leftPercent = progressMax > 0 ? (clampedValue / progressMax) * 100 : 0;

      return {
        leftPercent,
        time: formatTime(duration > 0 ? clampedValue : null),
      };
    },
    [duration, getClampedTimelineValue, progressMax],
  );

  const updateTimelinePreview = useCallback(
    (event: ReactMouseEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }

      const previewValue = getTimelineValueFromClientX(event.currentTarget, event.clientX);
      const { leftPercent } = getTimelinePointerMetrics(event.currentTarget, event.clientX);

      setTimelineHoverPreview({
        ...createTimelinePreview(previewValue),
        leftPercent,
      });
    },
    [createTimelinePreview, getTimelinePointerMetrics, getTimelineValueFromClientX, hasMedia],
  );

  const clearTimelinePreview = useCallback((): void => {
    setTimelineHoverPreview(null);
  }, []);

  const commitTimelineScrub = useCallback((): void => {
    setTimelineScrubbingState(false);

    const nextValue = timelineDragValueRef.current;
    if (nextValue === null) {
      return;
    }

    void setTimelinePosition(nextValue);
  }, [setTimelinePosition, setTimelineScrubbingState]);

  const handleTimelinePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }

      const nextValue = getTimelineValueFromClientX(event.currentTarget, event.clientX);
      setTimelineScrubbingState(true);
      setTimelineDragState(nextValue);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [getTimelineValueFromClientX, hasMedia, setTimelineDragState, setTimelineScrubbingState],
  );

  const handleTimelinePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>): void => {
      if (!hasMedia || !isTimelineScrubbing) {
        return;
      }

      const nextValue = getTimelineValueFromClientX(event.currentTarget, event.clientX);
      setTimelineDragState(nextValue);
    },
    [getTimelineValueFromClientX, hasMedia, isTimelineScrubbing, setTimelineDragState],
  );

  const handleTimelineChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }

      if (isTimelinePointerScrubbingRef.current) {
        return;
      }

      const nextValue = getClampedTimelineValue(Number(event.currentTarget.value));
      setTimelineDragState(nextValue);
      void setTimelinePosition(nextValue);
    },
    [
      getClampedTimelineValue,
      hasMedia,
      setTimelineDragState,
      setTimelinePosition,
    ],
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
    if (timelineDragValue === null || isTimelineScrubbing) {
      return;
    }

    if (Math.abs(timePos - timelineDragValue) > 0.25) {
      return;
    }

    setTimelineDragState(null);
  }, [isTimelineScrubbing, setTimelineDragState, timePos, timelineDragValue]);

  useEffect(() => {
    if (!hasMedia && timelineDragValue !== null) {
      setTimelineScrubbingState(false);
      setTimelineDragState(null);
    }
  }, [hasMedia, setTimelineDragState, setTimelineScrubbingState, timelineDragValue]);

  const timelineValue = timelineDragValue === null ? Math.min(timePos, progressMax) : timelineDragValue;
  let timelineProgressPercentValue = progressPercent;

  if (timelineDragValue !== null) {
    if (progressMax > 0) {
      timelineProgressPercentValue = `${(timelineValue / progressMax) * 100}%`;
    } else {
      timelineProgressPercentValue = "0%";
    }
  }

  return {
    displayedCurrentTime:
      timelineDragValue === null ? currentTime : formatTime(duration > 0 ? timelineValue : null),
    isTimelineScrubbing,
    timelinePreview:
      timelineDragValue === null ? timelineHoverPreview : createTimelinePreview(timelineDragValue),
    timelineProgressPercent: timelineProgressPercentValue,
    timelineValue,
    clearTimelinePreview,
    handleTimelineChange,
    handleTimelinePointerDown,
    handleTimelinePointerMove,
    updateTimelinePreview,
  };
}

function TimelineRow({
  displayedCurrentTime,
  totalTime,
  progressMax,
  timelineValue,
  timelineProgressPercent,
  isTimelineScrubbing,
  hasMedia,
  timelinePreview,
  clearTimelinePreview,
  handleTimelineChange,
  handleTimelinePointerDown,
  handleTimelinePointerMove,
  updateTimelinePreview,
}: TimelineRowProps) {
  return (
    <div className="dock-row dock-row--top">
      <span className="time-readout">{displayedCurrentTime}</span>
      <div className="timeline-slot">
        <input
          className={`timeline${isTimelineScrubbing ? " is-scrubbing" : ""}`}
          style={{ "--progress": timelineProgressPercent } as CSSProperties}
          type="range"
          min={0}
          max={progressMax}
          step="any"
          value={timelineValue}
          disabled={!hasMedia}
          onChange={handleTimelineChange}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelinePointerMove}
          onMouseEnter={updateTimelinePreview}
          onMouseMove={updateTimelinePreview}
          onMouseLeave={clearTimelinePreview}
          onBlur={clearTimelinePreview}
        />
        {timelinePreview ? (
          <span
            className="timeline-preview"
            style={
              {
                "--preview-position": `${timelinePreview.leftPercent}%`,
              } as CSSProperties
            }
          >
            {timelinePreview.time}
          </span>
        ) : null}
      </div>
      <span className="time-readout">{totalTime}</span>
    </div>
  );
}

export function PlayerControls({
  state,
  hasMedia,
  isFullscreen,
  isChromeHidden,
  isCyclingAudio,
  isCyclingSubtitles,
  audioTracks,
  subtitleTracks,
  currentTime,
  totalTime,
  progressMax,
  progressPercent,
  displayVolume,
  volumePercent,
  audioSummary,
  subtitleSummary,
  cycleAudioTrack,
  cycleSubtitleTrack,
  toggleFullscreen,
  handleControlDockMouseEnter,
  handleControlDockMouseLeave,
  togglePlayPause,
  seekBack,
  seekForward,
  toggleMute,
  setTimelinePosition,
  setVolume,
}: PlayerControlsProps) {
  const {
    displayedCurrentTime,
    isTimelineScrubbing,
    timelinePreview,
    timelineProgressPercent,
    timelineValue,
    clearTimelinePreview,
    handleTimelineChange,
    handleTimelinePointerDown,
    handleTimelinePointerMove,
    updateTimelinePreview,
  } = useTimelineControl({
    currentTime,
    duration: state.duration,
    hasMedia,
    progressMax,
    progressPercent,
    setTimelinePosition,
    timePos: state.timePos,
  });

  return (
    <section
      className={`control-dock${isChromeHidden ? " is-hidden" : ""}`}
      onMouseEnter={handleControlDockMouseEnter}
      onMouseLeave={handleControlDockMouseLeave}
    >
      <TimelineRow
        displayedCurrentTime={displayedCurrentTime}
        totalTime={totalTime}
        progressMax={progressMax}
        timelineValue={timelineValue}
        timelineProgressPercent={timelineProgressPercent}
        isTimelineScrubbing={isTimelineScrubbing}
        hasMedia={hasMedia}
        timelinePreview={timelinePreview}
        clearTimelinePreview={clearTimelinePreview}
        handleTimelineChange={handleTimelineChange}
        handleTimelinePointerDown={handleTimelinePointerDown}
        handleTimelinePointerMove={handleTimelinePointerMove}
        updateTimelinePreview={updateTimelinePreview}
      />

      <div className="dock-row dock-row--bottom">
        <VolumeCluster
          isMuted={state.mute}
          displayVolume={displayVolume}
          volumePercent={volumePercent}
          toggleMute={toggleMute}
          setVolume={setVolume}
        />
        <TransportCluster
          hasMedia={hasMedia}
          paused={state.paused}
          togglePlayPause={togglePlayPause}
          seekBack={seekBack}
          seekForward={seekForward}
        />
        <ToolCluster
          audioSummary={audioSummary}
          subtitleSummary={subtitleSummary}
          audioTrackCount={audioTracks.length}
          subtitleTrackCount={subtitleTracks.length}
          isCyclingAudio={isCyclingAudio}
          isCyclingSubtitles={isCyclingSubtitles}
          isFullscreen={isFullscreen}
          cycleAudioTrack={cycleAudioTrack}
          cycleSubtitleTrack={cycleSubtitleTrack}
          toggleFullscreen={toggleFullscreen}
        />
      </div>
    </section>
  );
}
