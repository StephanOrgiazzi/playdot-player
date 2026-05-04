import { PlayerUrlDialog } from "@features/mediaOpen/PlayerUrlDialog";
import { useOpenUrlDialog } from "@features/mediaOpen/useOpenUrlDialog";
import { PlayerContextMenu } from "@features/playerChrome/PlayerContextMenu";
import { useStageContextMenu } from "@features/playerChrome/useStageContextMenu";
import { ToastOverlay } from "@features/toaster/ToastOverlay";
import type { PlayerScreenProps } from "../model/types";
import { PlayerControls } from "./PlayerControls";
import { PlayerIcon, PlayerIconSprite } from "./PlayerIcons";
import { VideoViewport } from "./VideoViewport";

function getTrackMenuLabel(
  kind: "Audio" | "Subtitle",
  tracks: Array<{ selected: boolean }>,
): string {
  const total = tracks.length;
  const selectedIndex = tracks.findIndex((track) => track.selected);
  const current = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  return `${kind} Track (${current}/${total})`;
}

export function PlayerScreen(props: PlayerScreenProps) {
  const showEmptyState = !props.hasMedia && !props.isSwitchingSvp;
  const {
    isOpen: isUrlDialogOpen,
    isOpening: isOpeningUrl,
    urlInputValue,
    error: urlDialogError,
    inputRef: urlInputRef,
    open: showOpenUrlDialog,
    close: closeUrlDialog,
    submit: submitUrlDialog,
    setUrlInputValue,
  } = useOpenUrlDialog(props.openWebUrl);
  const { contextMenuPosition, contextMenuRef, closeContextMenu, handleStageContextMenu } =
    useStageContextMenu(isUrlDialogOpen);
  const audioTrackLabel = getTrackMenuLabel("Audio", props.audioTracks);
  const subtitleTrackLabel = getTrackMenuLabel("Subtitle", props.subtitleTracks);

  return (
    <main
      className={`app-shell${showEmptyState ? " is-empty" : ""}${props.isAudioArtworkActive ? " is-audio-artwork" : ""}${props.isCursorHidden ? " is-cursor-hidden" : ""}`}
    >
      <PlayerIconSprite />

      <header
        className={`titlebar${props.isChromeHidden ? " is-hidden" : ""}`}
        onMouseDown={props.handleTitlebarMouseDown}
      >
        <div className="titlebar__drag" />
        <button className="title-pill" type="button" onClick={props.handleTitlePillClick}>
          <PlayerIcon name="app-mark" className="icon icon--sm icon--app-mark" />
          <span className="title-pill__label">{props.filename || "No video loaded"}</span>
        </button>
        <div className="titlebar__right">
          <div className="titlebar__drag titlebar__drag--right" />
          <div className="window-controls">
            <button
              className="window-button"
              type="button"
              aria-label="Minimize"
              onClick={props.minimizeWindow}
            >
              <PlayerIcon name="minimize" className="icon icon--xs" />
            </button>
            <button
              className="window-button"
              type="button"
              aria-label={props.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={props.toggleFullscreen}
            >
              <PlayerIcon
                name={props.isFullscreen ? "restore" : "maximize"}
                className="icon icon--xs"
              />
            </button>
            <button
              className="window-button window-button--close"
              type="button"
              aria-label="Close"
              onClick={props.closeWindow}
            >
              <PlayerIcon name="close" className="icon icon--xs" />
            </button>
          </div>
        </div>
      </header>

      <section className="stage" onContextMenu={handleStageContextMenu}>
        <div className="stage__mesh" aria-hidden="true" />
        <VideoViewport
          initialized={props.initialized}
          onDoubleClick={props.handleVideoDoubleClick}
        />
        {props.isAudioArtworkActive && (
          <div className="audio-artwork" aria-hidden="true">
            <img className="audio-artwork__backdrop" src={props.audioArtworkUrl} alt="" />
            <div className="audio-artwork__wash" />
            <figure className="audio-artwork__cover">
              <img className="audio-artwork__image" src={props.audioArtworkUrl} alt="" />
            </figure>
          </div>
        )}

        {showEmptyState && (
          <div className="hero-empty">
            <h1 className="hero-empty__title">PLAY.</h1>
            <p className="hero-empty__copy">Drop a file or paste a web video URL.</p>
            <button className="hero-open-button" type="button" onClick={props.pickAndOpenMediaFile}>
              Open video
            </button>
          </div>
        )}

        {props.error && <p className="status-message">{props.error}</p>}
        <ToastOverlay toast={props.toast} />
        {contextMenuPosition && (
          <PlayerContextMenu
            ref={contextMenuRef}
            position={contextMenuPosition}
            hasMedia={props.hasMedia}
            isFsrEnabled={props.isFsrEnabled}
            isSvpAvailable={props.isSvpAvailable}
            isSvpEnabled={props.isSvpEnabled}
            isFullscreen={props.isFullscreen}
            onClose={closeContextMenu}
            showOpenUrlDialog={showOpenUrlDialog}
            slowDownPlayback={props.slowDownPlayback}
            speedUpPlayback={props.speedUpPlayback}
            zoomIn={props.zoomIn}
            zoomOut={props.zoomOut}
            increaseGamma={props.increaseGamma}
            decreaseGamma={props.decreaseGamma}
            increaseSubtitleScale={props.increaseSubtitleScale}
            decreaseSubtitleScale={props.decreaseSubtitleScale}
            audioTrackLabel={audioTrackLabel}
            subtitleTrackLabel={subtitleTrackLabel}
            audioTracks={props.audioTracks}
            subtitleTracks={props.subtitleTracks}
            selectAudioTrack={props.selectAudioTrack}
            selectSubtitleTrack={props.selectSubtitleTrack}
            toggleFsr={props.toggleFsr}
            toggleSvp={props.toggleSvp}
            toggleFullscreen={props.toggleFullscreen}
          />
        )}
        <PlayerUrlDialog
          isOpen={isUrlDialogOpen}
          isOpeningUrl={isOpeningUrl}
          inputRef={urlInputRef}
          urlInputValue={urlInputValue}
          urlDialogError={urlDialogError}
          onInputChange={setUrlInputValue}
          onClose={closeUrlDialog}
          onSubmit={submitUrlDialog}
        />
        <PlayerControls
          paused={props.paused}
          duration={props.duration}
          hasMedia={props.hasMedia}
          isFullscreen={props.isFullscreen}
          isChromeHidden={props.isChromeHidden}
          isCyclingAudio={props.isCyclingAudio}
          isCyclingSubtitles={props.isCyclingSubtitles}
          audioTracks={props.audioTracks}
          subtitleTracks={props.subtitleTracks}
          totalTime={props.totalTime}
          audioSummary={props.audioSummary}
          subtitleSummary={props.subtitleSummary}
          cycleAudioTrack={props.cycleAudioTrack}
          cycleSubtitleTrack={props.cycleSubtitleTrack}
          toggleFullscreen={props.toggleFullscreen}
          handleControlDockMouseEnter={props.handleControlDockMouseEnter}
          handleControlDockMouseLeave={props.handleControlDockMouseLeave}
          togglePlayPause={props.togglePlayPause}
          seekBack={props.seekBack}
          seekForward={props.seekForward}
          toggleMute={props.toggleMute}
          setTimelinePosition={props.setTimelinePosition}
          setVolume={props.setVolume}
        />
      </section>
    </main>
  );
}
