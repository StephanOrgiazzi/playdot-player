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
import { UI_VOLUME_MAX, getUiVolumeFromMpvVolume } from "@integrations/mpv/constants";
import { formatTime } from "@shared/lib/format";
import { usePlayerStateSelector } from "../controller/playerSession";
import type { PlayerControlsProps } from "../model/types";
import { ToolCluster, TransportCluster, VolumeCluster } from "./PlayerControlClusters";

const POINTER_NATIVE_CHANGE_BLOCK_MS = 80;

type TimelinePreview = {
  leftPercent: number;
  time: string;
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

type TimelineControl = {
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
  thumbnailUrl: string;
  clearTimelinePreview: () => void;
  handleTimelineChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleTimelinePointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  handleTimelinePointerMove: (event: ReactPointerEvent<HTMLInputElement>) => void;
  updateTimelinePreview: (event: ReactMouseEvent<HTMLInputElement>) => void;
};

function useTimelineControl({
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
      requestTimelineThumbnail(previewValue);
    },
    [
      createTimelinePreview,
      getTimelinePointerMetrics,
      getTimelineValueFromClientX,
      hasMedia,
      requestTimelineThumbnail,
    ],
  );

  const clearTimelinePreview = useCallback((): void => {
    setTimelineHoverPreview(null);
    clearTimelineThumbnail();
  }, [clearTimelineThumbnail]);

  const commitTimelineScrub = useCallback((): void => {
    ignoreNativeTimelineChangesBriefly();
    setTimelineScrubbingState(false);

    const nextValue = timelineDragValueRef.current;
    if (nextValue === null) {
      return;
    }

    setTimelinePosition(nextValue);
  }, [ignoreNativeTimelineChangesBriefly, setTimelinePosition, setTimelineScrubbingState]);

  const handleTimelinePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }

      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });

      const nextValue = getTimelineValueFromClientX(event.currentTarget, event.clientX);
      setTimelineScrubbingState(true);
      setTimelineDragState(nextValue);
      requestTimelineThumbnail(nextValue);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      getTimelineValueFromClientX,
      hasMedia,
      requestTimelineThumbnail,
      setTimelineDragState,
      setTimelineScrubbingState,
    ],
  );

  const handleTimelinePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>): void => {
      if (!hasMedia || !isTimelineScrubbing) {
        return;
      }

      const nextValue = getTimelineValueFromClientX(event.currentTarget, event.clientX);
      setTimelineDragState(nextValue);
      requestTimelineThumbnail(nextValue);
    },
    [
      getTimelineValueFromClientX,
      hasMedia,
      isTimelineScrubbing,
      requestTimelineThumbnail,
      setTimelineDragState,
    ],
  );

  const handleTimelineChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      if (!hasMedia) {
        return;
      }

      if (isTimelinePointerScrubbingRef.current || ignoreNativeTimelineChangeRef.current) {
        return;
      }

      const nextValue = getClampedTimelineValue(Number(event.currentTarget.value));
      setTimelineDragState(nextValue);
      setTimelinePosition(nextValue);
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
    if (timelineDragValue === null || isTimelineScrubbing) {
      return;
    }

    if (Math.abs(timePos - timelineDragValue) > 0.25) {
      return;
    }

    setTimelineDragState(null);
  }, [isTimelineScrubbing, setTimelineDragState, timePos, timelineDragValue]);

  useEffect(() => {
    return subscribeTimelineThumbnail(setThumbnailUrl);
  }, [subscribeTimelineThumbnail]);

  useEffect(() => {
    if (!hasMedia && timelineDragValue !== null) {
      setTimelineScrubbingState(false);
      setTimelineDragState(null);
    }
    if (!hasMedia) {
      clearTimelineThumbnail();
    }
  }, [
    clearTimelineThumbnail,
    hasMedia,
    setTimelineDragState,
    setTimelineScrubbingState,
    timelineDragValue,
  ]);

  const timelineValue =
    timelineDragValue === null ? Math.min(timePos, progressMax) : timelineDragValue;
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
  thumbnailUrl,
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
          <div
            className={`timeline-preview${thumbnailUrl ? " has-thumbnail" : ""}`}
            style={
              {
                "--preview-position": `${timelinePreview.leftPercent}%`,
              } as CSSProperties
            }
          >
            {thumbnailUrl ? (
              <img className="timeline-preview__image" src={thumbnailUrl} alt="" />
            ) : null}
            <span className="timeline-preview__time">{timelinePreview.time}</span>
          </div>
        ) : null}
      </div>
      <span className="time-readout">{totalTime}</span>
    </div>
  );
}

function TimelineRowContainer({
  hasMedia,
  setTimelinePosition,
  requestTimelineThumbnail,
  clearTimelineThumbnail,
  subscribeTimelineThumbnail,
}: Pick<
  PlayerControlsProps,
  | "hasMedia"
  | "setTimelinePosition"
  | "requestTimelineThumbnail"
  | "clearTimelineThumbnail"
  | "subscribeTimelineThumbnail"
>) {
  const duration = usePlayerStateSelector((state) => state.duration);
  const timePos = usePlayerStateSelector((state) => state.timePos);
  const totalTime = formatTime(duration);
  const {
    displayedCurrentTime,
    isTimelineScrubbing,
    timelinePreview,
    timelineProgressPercent,
    timelineValue,
    progressMax,
    thumbnailUrl,
    clearTimelinePreview,
    handleTimelineChange,
    handleTimelinePointerDown,
    handleTimelinePointerMove,
    updateTimelinePreview,
  } = useTimelineControl({
    duration,
    hasMedia,
    setTimelinePosition,
    requestTimelineThumbnail,
    clearTimelineThumbnail,
    subscribeTimelineThumbnail,
    timePos,
  });

  return (
    <TimelineRow
      displayedCurrentTime={displayedCurrentTime}
      totalTime={totalTime}
      progressMax={progressMax}
      timelineValue={timelineValue}
      timelineProgressPercent={timelineProgressPercent}
      isTimelineScrubbing={isTimelineScrubbing}
      hasMedia={hasMedia}
      timelinePreview={timelinePreview}
      thumbnailUrl={thumbnailUrl}
      clearTimelinePreview={clearTimelinePreview}
      handleTimelineChange={handleTimelineChange}
      handleTimelinePointerDown={handleTimelinePointerDown}
      handleTimelinePointerMove={handleTimelinePointerMove}
      updateTimelinePreview={updateTimelinePreview}
    />
  );
}

function VolumeClusterContainer({
  setVolume,
  toggleMute,
}: Pick<PlayerControlsProps, "setVolume" | "toggleMute">) {
  const isMuted = usePlayerStateSelector((state) => state.mute);
  const volume = usePlayerStateSelector((state) => state.volume);
  const displayVolume = getUiVolumeFromMpvVolume(volume);
  const volumePercent = `${(displayVolume / UI_VOLUME_MAX) * 100}%`;

  return (
    <VolumeCluster
      isMuted={isMuted}
      displayVolume={displayVolume}
      volumePercent={volumePercent}
      toggleMute={toggleMute}
      setVolume={setVolume}
    />
  );
}

export function PlayerControls({
  hasMedia,
  isFullscreen,
  isChromeHidden,
  isCyclingAudio,
  isCyclingSubtitles,
  audioTracks,
  subtitleTracks,
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
  requestTimelineThumbnail,
  clearTimelineThumbnail,
  subscribeTimelineThumbnail,
  setVolume,
}: PlayerControlsProps) {
  const paused = usePlayerStateSelector((state) => state.paused);

  return (
    <section
      className={`control-dock${isChromeHidden ? " is-hidden" : ""}`}
      onMouseEnter={handleControlDockMouseEnter}
      onMouseLeave={handleControlDockMouseLeave}
    >
      <TimelineRowContainer
        hasMedia={hasMedia}
        setTimelinePosition={setTimelinePosition}
        requestTimelineThumbnail={requestTimelineThumbnail}
        clearTimelineThumbnail={clearTimelineThumbnail}
        subscribeTimelineThumbnail={subscribeTimelineThumbnail}
      />

      <div className="dock-row dock-row--bottom">
        <VolumeClusterContainer setVolume={setVolume} toggleMute={toggleMute} />
        <TransportCluster
          hasMedia={hasMedia}
          paused={paused}
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
