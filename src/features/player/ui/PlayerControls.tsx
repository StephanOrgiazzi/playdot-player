import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { UI_VOLUME_MAX, getUiVolumeFromMpvVolume } from "@integrations/mpv/constants";
import { formatTime } from "@shared/lib/format";
import { usePlayerStateSelector } from "../controller/playerSession";
import type { PlayerControlsProps } from "../model/types";
import { ToolCluster, TransportCluster, VolumeCluster } from "./PlayerControlClusters";
import { useTimelineControl, type TimelinePreview } from "./useTimelineControl";

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
};

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
          onPointerEnter={handleTimelinePointerMove}
          onPointerMove={handleTimelinePointerMove}
          onPointerLeave={clearTimelinePreview}
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
