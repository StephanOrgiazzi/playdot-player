import { PlayerUrlDialog } from "@features/mediaOpen/PlayerUrlDialog";
import { useOpenUrlDialog } from "@features/mediaOpen/useOpenUrlDialog";
import { PlayerContextMenu } from "@features/playerChrome/PlayerContextMenu";
import { useStageContextMenu } from "@features/playerChrome/useStageContextMenu";
import { ToastOverlay } from "@features/toaster/ToastOverlay";
import type { PlayerScreenProps } from "../model/types";
import { PlayerControls } from "./PlayerControls";
import { PlayerIcon, PlayerIconSprite } from "./PlayerIcons";
import { VideoViewport } from "./VideoViewport";

export function PlayerScreen({
  state,
  error,
  toast,
  isFullscreen,
  isFsrEnabled,
  isSvpAvailable,
  isSvpEnabled,
  isSwitchingSvp,
  isChromeHidden,
  isCursorHidden,
  isCyclingAudio,
  isCyclingSubtitles,
  hasMedia,
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
  pickAndOpenMediaFile,
  openWebUrl,
  cycleAudioTrack,
  cycleSubtitleTrack,
  toggleFsr,
  toggleSvp,
  toggleFullscreen,
  handleTitlebarMouseDown,
  handleTitlePillClick,
  handleControlDockMouseEnter,
  handleControlDockMouseLeave,
  handleVideoDoubleClick,
  togglePlayPause,
  seekBack,
  seekForward,
  slowDownPlayback,
  speedUpPlayback,
  toggleMute,
  zoomIn,
  zoomOut,
  increaseSubtitleScale,
  decreaseSubtitleScale,
  setTimelinePosition,
  setVolume,
  minimizeWindow,
  closeWindow,
}: PlayerScreenProps) {
  const showEmptyState = !hasMedia && !isSwitchingSvp;
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
  } = useOpenUrlDialog(openWebUrl);
  const { contextMenuPosition, contextMenuRef, closeContextMenu, handleStageContextMenu } =
    useStageContextMenu(isUrlDialogOpen);

  return (
    <main
      className={`app-shell${showEmptyState ? " is-empty" : ""}${isCursorHidden ? " is-cursor-hidden" : ""}`}
    >
      <PlayerIconSprite />

      <header
        className={`titlebar${isChromeHidden ? " is-hidden" : ""}`}
        onMouseDown={handleTitlebarMouseDown}
      >
        <div className="titlebar__drag" />
        <button className="title-pill" type="button" onClick={handleTitlePillClick}>
          <PlayerIcon name="app-mark" className="icon icon--sm icon--app-mark" />
          <span className="title-pill__label">{state.filename || "No video loaded"}</span>
        </button>
        <div className="titlebar__right">
          <div className="titlebar__drag titlebar__drag--right" />
          <div className="window-controls">
            <button
              className="window-button"
              type="button"
              aria-label="Minimize"
              onClick={minimizeWindow}
            >
              <PlayerIcon name="minimize" className="icon icon--xs" />
            </button>
            <button
              className="window-button"
              type="button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
            >
              <PlayerIcon
                name={isFullscreen ? "restore" : "maximize"}
                className="icon icon--xs"
              />
            </button>
            <button
              className="window-button window-button--close"
              type="button"
              aria-label="Close"
              onClick={closeWindow}
            >
              <PlayerIcon name="close" className="icon icon--xs" />
            </button>
          </div>
        </div>
      </header>

      <section className="stage" onContextMenu={handleStageContextMenu}>
        <div className="stage__mesh" aria-hidden="true" />
        <VideoViewport initialized={state.initialized} onDoubleClick={handleVideoDoubleClick} />

        {showEmptyState && (
          <div className="hero-empty">
            <h1 className="hero-empty__title">PLAY.</h1>
            <p className="hero-empty__copy">Drop a file or paste a web video URL.</p>
            <button className="hero-open-button" type="button" onClick={pickAndOpenMediaFile}>
              Open video
            </button>
          </div>
        )}

        {error && <p className="status-message">{error}</p>}
        <ToastOverlay toast={toast} />
        {contextMenuPosition && (
          <PlayerContextMenu
            ref={contextMenuRef}
            position={contextMenuPosition}
            hasMedia={hasMedia}
            isFsrEnabled={isFsrEnabled}
            isSvpAvailable={isSvpAvailable}
            isSvpEnabled={isSvpEnabled}
            isFullscreen={isFullscreen}
            onClose={closeContextMenu}
            showOpenUrlDialog={showOpenUrlDialog}
            slowDownPlayback={slowDownPlayback}
            speedUpPlayback={speedUpPlayback}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            increaseSubtitleScale={increaseSubtitleScale}
            decreaseSubtitleScale={decreaseSubtitleScale}
            cycleAudioTrack={cycleAudioTrack}
            cycleSubtitleTrack={cycleSubtitleTrack}
            toggleFsr={toggleFsr}
            toggleSvp={toggleSvp}
            toggleFullscreen={toggleFullscreen}
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
          state={state}
          hasMedia={hasMedia}
          isFullscreen={isFullscreen}
          isChromeHidden={isChromeHidden}
          isCyclingAudio={isCyclingAudio}
          isCyclingSubtitles={isCyclingSubtitles}
          audioTracks={audioTracks}
          subtitleTracks={subtitleTracks}
          currentTime={currentTime}
          totalTime={totalTime}
          progressMax={progressMax}
          progressPercent={progressPercent}
          displayVolume={displayVolume}
          volumePercent={volumePercent}
          audioSummary={audioSummary}
          subtitleSummary={subtitleSummary}
          cycleAudioTrack={cycleAudioTrack}
          cycleSubtitleTrack={cycleSubtitleTrack}
          toggleFullscreen={toggleFullscreen}
          handleControlDockMouseEnter={handleControlDockMouseEnter}
          handleControlDockMouseLeave={handleControlDockMouseLeave}
          togglePlayPause={togglePlayPause}
          seekBack={seekBack}
          seekForward={seekForward}
          toggleMute={toggleMute}
          setTimelinePosition={setTimelinePosition}
          setVolume={setVolume}
        />
      </section>
    </main>
  );
}
