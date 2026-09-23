import { type CSSProperties } from "react";
import { UI_VOLUME_MAX, getUiVolumeFromMpvVolume } from "@integrations/mpv/constants";
import { formatTime } from "@shared/lib/format";
import { usePlayerState } from "../controller/playerSession";
import type { PlayerControlsProps } from "../model/types";
import { ToolCluster, TransportCluster, VolumeCluster } from "./PlayerControlClusters";
import { useTimelineControl } from "./useTimelineControl";

type TimelineStyle = CSSProperties & {
  "--preview-position"?: string;
  "--progress"?: string;
};

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
  const duration = usePlayerState("duration");
  const timePos = usePlayerState("timePos");
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
    <div className="dock-row dock-row--top">
      <span className="time-readout">{displayedCurrentTime}</span>
      <div className="timeline-slot">
        <input
          className={`timeline${isTimelineScrubbing ? " is-scrubbing" : ""}`}
          aria-label="Seek position"
          aria-valuetext={displayedCurrentTime}
          // SAFETY: The custom CSS property is consumed by the timeline stylesheet.
          style={{ "--progress": timelineProgressPercent } as TimelineStyle}
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
              // SAFETY: The custom CSS property is consumed by the timeline preview stylesheet.
              {
                "--preview-position": `${timelinePreview.leftPercent}%`,
              } as TimelineStyle
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

function VolumeClusterContainer({
  setVolume,
  toggleMute,
}: Pick<PlayerControlsProps, "setVolume" | "toggleMute">) {
  const isMuted = usePlayerState("mute");
  const volume = usePlayerState("volume");
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
  const paused = usePlayerState("paused");

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
