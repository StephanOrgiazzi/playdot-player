import {
  forwardRef,
  useCallback,
  useState,
  type Dispatch,
  type JSX,
  type WheelEvent,
  type SetStateAction,
} from "react";
import type { MediaTrack } from "@features/player/model/playerState";
import { PlayerIcon } from "@features/player/ui/PlayerIcons";
import type { PlayerAction, TrackSelectionAction } from "@features/player/model/types";
import { CONTEXT_MENU_SUBMENU_WIDTH, CONTEXT_MENU_WIDTH } from "./constants";
import { MenuActionItem } from "./MenuActionItem";
import { useSubmenuViewportStyle } from "./useSubmenuViewportStyle";

type PlayerContextMenuProps = {
  position: { x: number; y: number };
  hasMedia: boolean;
  hasVideo: boolean;
  isFsrEnabled: boolean;
  isAudioNormalizerEnabled: boolean;
  isStereoDownmixEnabled: boolean;
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  showOpenUrlDialog: PlayerAction;
  slowDownPlayback: PlayerAction;
  speedUpPlayback: PlayerAction;
  zoomIn: PlayerAction;
  zoomOut: PlayerAction;
  increaseGamma: PlayerAction;
  decreaseGamma: PlayerAction;
  increaseSubtitleScale: PlayerAction;
  decreaseSubtitleScale: PlayerAction;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  selectAudioTrack: TrackSelectionAction;
  selectSubtitleTrack: TrackSelectionAction;
  toggleFsr: PlayerAction;
  toggleAudioNormalizer: PlayerAction;
  toggleStereoDownmix: PlayerAction;
  toggleSvp: PlayerAction;
  toggleFullscreen: PlayerAction;
};

function getTrackDisplayLabel(track: MediaTrack): string {
  const title = track.title.trim();
  const language = track.lang?.trim();

  if (title && language && title.toLowerCase() !== language.toLowerCase()) {
    return `${language} (${title})`;
  }

  return (language ?? title) || `Track ${track.id}`;
}

function keepWheelInsideSubmenu(event: WheelEvent<HTMLDivElement>): void {
  event.stopPropagation();
}

type PlaybackOptionsSubmenuProps = {
  hasMedia: boolean;
  hasVideo: boolean;
  isSubmenuOpenLeft: boolean;
  isPlaybackSubmenuOpen: boolean;
  runAction: (action: PlayerAction) => void;
  setIsPlaybackSubmenuOpen: Dispatch<SetStateAction<boolean>>;
  speedUpPlayback: PlayerAction;
  slowDownPlayback: PlayerAction;
  zoomIn: PlayerAction;
  zoomOut: PlayerAction;
  increaseGamma: PlayerAction;
  decreaseGamma: PlayerAction;
  increaseSubtitleScale: PlayerAction;
  decreaseSubtitleScale: PlayerAction;
};

function PlaybackOptionsSubmenu({
  hasMedia,
  hasVideo,
  isSubmenuOpenLeft,
  isPlaybackSubmenuOpen,
  runAction,
  setIsPlaybackSubmenuOpen,
  speedUpPlayback,
  slowDownPlayback,
  zoomIn,
  zoomOut,
  increaseGamma,
  decreaseGamma,
  increaseSubtitleScale,
  decreaseSubtitleScale,
}: PlaybackOptionsSubmenuProps): JSX.Element {
  const { panelRef, panelStyle } = useSubmenuViewportStyle(isPlaybackSubmenuOpen && hasMedia);

  return (
    <div
      className={`player-context-menu__submenu-group${isPlaybackSubmenuOpen ? " is-open" : ""}${
        isSubmenuOpenLeft ? " is-open-left" : ""
      }`}
      onPointerEnter={(): void => {
        setIsPlaybackSubmenuOpen(true);
      }}
      onPointerLeave={(): void => {
        setIsPlaybackSubmenuOpen(false);
      }}
      onFocusCapture={(): void => {
        setIsPlaybackSubmenuOpen(true);
      }}
      onBlurCapture={(event): void => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPlaybackSubmenuOpen(false);
        }
      }}
    >
      <button
        className={`player-context-menu__item player-context-menu__item--submenu${
          isSubmenuOpenLeft ? " is-open-left" : ""
        }`}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isPlaybackSubmenuOpen}
        disabled={!hasMedia}
        onClick={(): void => {
          setIsPlaybackSubmenuOpen((current) => !current);
        }}
      >
        <span className="player-context-menu__item-label">Playback Options</span>
      </button>
      {isPlaybackSubmenuOpen && hasMedia ? (
        <div
          ref={panelRef}
          className={`player-context-menu__submenu-panel${isSubmenuOpenLeft ? " is-open-left" : ""}`}
          role="menu"
          style={panelStyle}
          onWheel={keepWheelInsideSubmenu}
        >
          <MenuActionItem
            label="Speed Up"
            shortcut="Ctrl+Right"
            disabled={!hasMedia}
            onClick={(): void => {
              runAction(speedUpPlayback);
            }}
          />
          <MenuActionItem
            label="Slow Down"
            shortcut="Ctrl+Left"
            disabled={!hasMedia}
            onClick={(): void => {
              runAction(slowDownPlayback);
            }}
          />
          {hasVideo ? (
            <>
              <MenuActionItem
                label="Zoom In"
                shortcut="Ctrl++"
                onClick={(): void => {
                  runAction(zoomIn);
                }}
              />
              <MenuActionItem
                label="Zoom Out"
                shortcut="Ctrl+-"
                onClick={(): void => {
                  runAction(zoomOut);
                }}
              />
              <MenuActionItem
                label="Increase Gamma"
                shortcut="Alt+Right"
                onClick={(): void => {
                  runAction(increaseGamma);
                }}
              />
              <MenuActionItem
                label="Decrease Gamma"
                shortcut="Alt+Left"
                onClick={(): void => {
                  runAction(decreaseGamma);
                }}
              />
              <MenuActionItem
                label="Increase Subtitle Size"
                shortcut="Ctrl+Up"
                onClick={(): void => {
                  runAction(increaseSubtitleScale);
                }}
              />
              <MenuActionItem
                label="Decrease Subtitle Size"
                shortcut="Ctrl+Down"
                onClick={(): void => {
                  runAction(decreaseSubtitleScale);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type TrackSelectionSubmenuProps = {
  buttonLabel: string;
  shortcut: string;
  hasMedia: boolean;
  isSubmenuOpenLeft: boolean;
  isOpen: boolean;
  tracks: MediaTrack[];
  selectedTrackId: number | null;
  includeOffOption?: boolean;
  onSelect: TrackSelectionAction;
  runAction: (action: PlayerAction) => void;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

function TrackSelectionSubmenu({
  buttonLabel,
  shortcut,
  hasMedia,
  isSubmenuOpenLeft,
  isOpen,
  tracks,
  selectedTrackId,
  includeOffOption = false,
  onSelect,
  runAction,
  setIsOpen,
}: TrackSelectionSubmenuProps): JSX.Element {
  const hasSelectableTrack = tracks.length > 0;
  const disabled = !hasMedia || !hasSelectableTrack;
  const { panelRef, panelStyle } = useSubmenuViewportStyle(isOpen && !disabled);

  return (
    <div
      className={`player-context-menu__submenu-group${isOpen ? " is-open" : ""}${
        isSubmenuOpenLeft ? " is-open-left" : ""
      }`}
      onPointerEnter={(): void => {
        setIsOpen(true);
      }}
      onPointerLeave={(): void => {
        setIsOpen(false);
      }}
      onFocusCapture={(): void => {
        setIsOpen(true);
      }}
      onBlurCapture={(event): void => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        className={`player-context-menu__item player-context-menu__item--submenu${
          isSubmenuOpenLeft ? " is-open-left" : ""
        }`}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={(): void => {
          setIsOpen((current) => !current);
        }}
      >
        <span className="player-context-menu__item-label">{buttonLabel}</span>
        <span className="player-context-menu__item-shortcut">{shortcut}</span>
      </button>
      {isOpen && !disabled ? (
        <div
          ref={panelRef}
          className={`player-context-menu__submenu-panel${isSubmenuOpenLeft ? " is-open-left" : ""}`}
          role="menu"
          style={panelStyle}
          onWheel={keepWheelInsideSubmenu}
        >
          {includeOffOption ? (
            <MenuActionItem
              label="Off"
              role="menuitemcheckbox"
              ariaChecked={selectedTrackId === null}
              onClick={(): void => {
                runAction(() => {
                  onSelect("no");
                });
              }}
              icon={
                selectedTrackId === null ? (
                  <PlayerIcon name="check" className="icon icon--xs" />
                ) : null
              }
            />
          ) : null}
          {tracks.map((track) => (
            <MenuActionItem
              key={track.id}
              label={getTrackDisplayLabel(track)}
              role="menuitemcheckbox"
              ariaChecked={track.id === selectedTrackId}
              onClick={(): void => {
                runAction(() => {
                  onSelect(track.id);
                });
              }}
              icon={
                track.id === selectedTrackId ? (
                  <PlayerIcon name="check" className="icon icon--xs" />
                ) : null
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const PlayerContextMenu = forwardRef<HTMLDivElement, PlayerContextMenuProps>(
  function PlayerContextMenu(
    {
      position,
      hasMedia,
      hasVideo,
      isFsrEnabled,
      isAudioNormalizerEnabled,
      isStereoDownmixEnabled,
      isSvpAvailable,
      isSvpEnabled,
      isFullscreen,
      onClose,
      showOpenUrlDialog,
      slowDownPlayback,
      speedUpPlayback,
      zoomIn,
      zoomOut,
      increaseGamma,
      decreaseGamma,
      increaseSubtitleScale,
      decreaseSubtitleScale,
      audioTrackLabel,
      subtitleTrackLabel,
      audioTracks,
      subtitleTracks,
      selectAudioTrack,
      selectSubtitleTrack,
      toggleFsr,
      toggleAudioNormalizer,
      toggleStereoDownmix,
      toggleSvp,
      toggleFullscreen,
    },
    ref,
  ) {
    const [isPlaybackSubmenuOpen, setIsPlaybackSubmenuOpen] = useState(false);
    const [isAudioTracksSubmenuOpen, setIsAudioTracksSubmenuOpen] = useState(false);
    const [isSubtitleTracksSubmenuOpen, setIsSubtitleTracksSubmenuOpen] = useState(false);
    const isSubmenuOpenLeft =
      typeof window === "undefined"
        ? false
        : position.x + CONTEXT_MENU_WIDTH + CONTEXT_MENU_SUBMENU_WIDTH + 8 > window.innerWidth;

    const runAction = useCallback(
      (action: PlayerAction): void => {
        onClose();
        action();
      },
      [onClose],
    );

    return (
      <div
        ref={ref}
        className="player-context-menu"
        role="menu"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onContextMenu={(event): void => {
          event.preventDefault();
        }}
      >
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          onClick={(): void => {
            runAction(showOpenUrlDialog);
          }}
        >
          <span className="player-context-menu__item-label">Open Web URL...</span>
          <span className="player-context-menu__item-shortcut">Ctrl+V</span>
        </button>
        <div className="player-context-menu__separator" aria-hidden="true" />
        <PlaybackOptionsSubmenu
          hasMedia={hasMedia}
          hasVideo={hasVideo}
          isSubmenuOpenLeft={isSubmenuOpenLeft}
          isPlaybackSubmenuOpen={isPlaybackSubmenuOpen}
          runAction={runAction}
          setIsPlaybackSubmenuOpen={setIsPlaybackSubmenuOpen}
          speedUpPlayback={speedUpPlayback}
          slowDownPlayback={slowDownPlayback}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          increaseGamma={increaseGamma}
          decreaseGamma={decreaseGamma}
          increaseSubtitleScale={increaseSubtitleScale}
          decreaseSubtitleScale={decreaseSubtitleScale}
        />
        {hasVideo ? (
          <MenuActionItem
            label="Upscale"
            shortcut="U"
            onClick={(): void => {
              runAction(toggleFsr);
            }}
            icon={isFsrEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
          />
        ) : null}
        {hasVideo ? (
          <MenuActionItem
            label="Audio Normalizer"
            shortcut="N"
            role="menuitemcheckbox"
            ariaChecked={isAudioNormalizerEnabled}
            onClick={(): void => {
              runAction(toggleAudioNormalizer);
            }}
            icon={
              isAudioNormalizerEnabled ? (
                <PlayerIcon name="check" className="icon icon--xs" />
              ) : null
            }
          />
        ) : null}
        <MenuActionItem
          label="Stereo Downmix"
          shortcut="D"
          role="menuitemcheckbox"
          ariaChecked={isStereoDownmixEnabled}
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(toggleStereoDownmix);
          }}
          icon={
            isStereoDownmixEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null
          }
        />
        {hasVideo && isSvpAvailable ? (
          <MenuActionItem
            label="Use Installed SVP"
            role="menuitemcheckbox"
            ariaChecked={isSvpEnabled}
            disabled={!hasMedia}
            onClick={(): void => {
              runAction(toggleSvp);
            }}
            icon={isSvpEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
          />
        ) : null}
        <div className="player-context-menu__separator" aria-hidden="true" />
        <TrackSelectionSubmenu
          buttonLabel={audioTrackLabel}
          shortcut="A"
          hasMedia={hasMedia}
          isSubmenuOpenLeft={isSubmenuOpenLeft}
          isOpen={isAudioTracksSubmenuOpen}
          tracks={audioTracks}
          selectedTrackId={audioTracks.find((track) => track.selected)?.id ?? null}
          onSelect={selectAudioTrack}
          runAction={runAction}
          setIsOpen={setIsAudioTracksSubmenuOpen}
        />
        {hasVideo ? (
          <TrackSelectionSubmenu
            buttonLabel={subtitleTrackLabel}
            shortcut="S"
            hasMedia={hasMedia}
            isSubmenuOpenLeft={isSubmenuOpenLeft}
            isOpen={isSubtitleTracksSubmenuOpen}
            tracks={subtitleTracks}
            selectedTrackId={subtitleTracks.find((track) => track.selected)?.id ?? null}
            includeOffOption
            onSelect={selectSubtitleTrack}
            runAction={runAction}
            setIsOpen={setIsSubtitleTracksSubmenuOpen}
          />
        ) : null}
        <div className="player-context-menu__separator" aria-hidden="true" />
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          onClick={(): void => {
            runAction(toggleFullscreen);
          }}
        >
          <span className="player-context-menu__item-label">
            {isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
          </span>
          <span className="player-context-menu__item-shortcut">Alt+Enter</span>
        </button>
      </div>
    );
  },
);
