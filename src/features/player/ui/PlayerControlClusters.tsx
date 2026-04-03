import { type CSSProperties } from "react";
import { UI_VOLUME_MAX } from "@integrations/mpv/constants";
import type { PlayerControlsProps } from "../model/types";
import { PlayerIcon } from "./PlayerIcons";

type VolumeClusterProps = {
  isMuted: boolean;
  displayVolume: number;
  volumePercent: string;
  toggleMute: PlayerControlsProps["toggleMute"];
  setVolume: PlayerControlsProps["setVolume"];
};

type TransportClusterProps = {
  hasMedia: boolean;
  paused: boolean;
  togglePlayPause: PlayerControlsProps["togglePlayPause"];
  seekBack: PlayerControlsProps["seekBack"];
  seekForward: PlayerControlsProps["seekForward"];
};

type ToolClusterProps = {
  audioSummary: string;
  subtitleSummary: string;
  audioTrackCount: number;
  subtitleTrackCount: number;
  isCyclingAudio: boolean;
  isCyclingSubtitles: boolean;
  isFullscreen: boolean;
  cycleAudioTrack: PlayerControlsProps["cycleAudioTrack"];
  cycleSubtitleTrack: PlayerControlsProps["cycleSubtitleTrack"];
  toggleFullscreen: PlayerControlsProps["toggleFullscreen"];
};

export function VolumeCluster({
  isMuted,
  displayVolume,
  volumePercent,
  toggleMute,
  setVolume,
}: VolumeClusterProps) {
  return (
    <div className="volume-cluster">
      <button
        className="dock-button"
        type="button"
        aria-label={isMuted ? "Unmute" : "Mute"}
        onClick={toggleMute}
      >
        <span className="icon-stack">
          <PlayerIcon
            name="volume"
            className={`icon icon--md${isMuted ? " is-hidden" : ""}`}
          />
          <PlayerIcon
            name="volume-off"
            className={`icon icon--md${isMuted ? "" : " is-hidden"}`}
          />
        </span>
      </button>
      <input
        className="volume"
        style={{ "--progress": volumePercent } as CSSProperties}
        type="range"
        min={0}
        max={UI_VOLUME_MAX}
        step={1}
        value={displayVolume}
        onChange={(event) => void setVolume(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export function TransportCluster({
  hasMedia,
  paused,
  togglePlayPause,
  seekBack,
  seekForward,
}: TransportClusterProps) {
  return (
    <div className="transport-cluster">
      <button
        className="dock-button dock-button--transport"
        type="button"
        aria-label="Back 5 seconds"
        disabled={!hasMedia}
        onClick={seekBack}
      >
        <PlayerIcon name="backward" className="icon icon--md icon--filled" />
      </button>
      <button
        className={`dock-button dock-button--transport dock-button--primary${
          hasMedia ? "" : " dock-button--inert"
        }`}
        type="button"
        aria-label={paused ? "Play" : "Pause"}
        disabled={!hasMedia}
        onClick={togglePlayPause}
      >
        <span className="icon-stack">
          <PlayerIcon
            name="play"
            className={`icon icon--lg icon--filled${paused ? "" : " is-hidden"}`}
          />
          <PlayerIcon
            name="pause"
            className={`icon icon--lg icon--filled${paused ? " is-hidden" : ""}`}
          />
        </span>
      </button>
      <button
        className="dock-button dock-button--transport"
        type="button"
        aria-label="Forward 5 seconds"
        disabled={!hasMedia}
        onClick={seekForward}
      >
        <PlayerIcon name="forward" className="icon icon--md icon--filled" />
      </button>
    </div>
  );
}

export function ToolCluster({
  audioSummary,
  subtitleSummary,
  audioTrackCount,
  subtitleTrackCount,
  isCyclingAudio,
  isCyclingSubtitles,
  isFullscreen,
  cycleAudioTrack,
  cycleSubtitleTrack,
  toggleFullscreen,
}: ToolClusterProps) {
  return (
    <div className="dock-tools">
      <button
        className="dock-button"
        type="button"
        aria-label={`Cycle audio track. Current: ${audioSummary}`}
        title={`Audio: ${audioSummary}`}
        disabled={audioTrackCount < 2 || isCyclingAudio}
        onClick={cycleAudioTrack}
      >
        <PlayerIcon name="audio-track" className="icon icon--md" />
      </button>
      <button
        className="dock-button"
        type="button"
        aria-label={`Cycle subtitles. Current: ${subtitleSummary}`}
        title={`Subtitles: ${subtitleSummary}`}
        disabled={subtitleTrackCount === 0 || isCyclingSubtitles}
        onClick={cycleSubtitleTrack}
      >
        <PlayerIcon name="subtitles" className="icon icon--md" />
      </button>
      <button
        className="dock-button"
        type="button"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        onClick={toggleFullscreen}
      >
        <span className="icon-stack">
          <PlayerIcon
            name="fullscreen-enter"
            className={`icon icon--md${isFullscreen ? " is-hidden" : ""}`}
          />
          <PlayerIcon
            name="fullscreen-exit"
            className={`icon icon--md${isFullscreen ? "" : " is-hidden"}`}
          />
        </span>
      </button>
    </div>
  );
}
