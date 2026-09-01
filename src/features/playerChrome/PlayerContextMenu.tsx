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
import { EnhancementMenuItems } from "./EnhancementMenuItems";
import { InterfaceMenuItems } from "./InterfaceMenuItems";
import { MenuActionItem } from "./MenuActionItem";
import { PlaybackOptionsSubmenu } from "./PlaybackOptionsSubmenu";
import { useSubmenuViewportStyle } from "./useSubmenuViewportStyle";

type PlayerContextMenuProps = {
  position: { x: number; y: number };
  initialized: boolean;
  hasMedia: boolean;
  hasVideo: boolean;
  isFsrEnabled: boolean;
  isAudioNormalizerEnabled: boolean;
  isStereoDownmixEnabled: boolean;
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isFullscreen: boolean;
  isModernInterfaceEnabled: boolean;
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
  toggleModernInterface: PlayerAction;
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

type TrackMenuItemsProps = Pick<
  PlayerContextMenuProps,
  | "hasMedia"
  | "hasVideo"
  | "audioTrackLabel"
  | "subtitleTrackLabel"
  | "audioTracks"
  | "subtitleTracks"
  | "selectAudioTrack"
  | "selectSubtitleTrack"
> & {
  isSubmenuOpenLeft: boolean;
  isAudioTracksSubmenuOpen: boolean;
  isSubtitleTracksSubmenuOpen: boolean;
  runAction: (action: PlayerAction) => void;
  setIsAudioTracksSubmenuOpen: Dispatch<SetStateAction<boolean>>;
  setIsSubtitleTracksSubmenuOpen: Dispatch<SetStateAction<boolean>>;
};

function TrackMenuItems({
  hasMedia,
  hasVideo,
  audioTrackLabel,
  subtitleTrackLabel,
  audioTracks,
  subtitleTracks,
  selectAudioTrack,
  selectSubtitleTrack,
  isSubmenuOpenLeft,
  isAudioTracksSubmenuOpen,
  isSubtitleTracksSubmenuOpen,
  runAction,
  setIsAudioTracksSubmenuOpen,
  setIsSubtitleTracksSubmenuOpen,
}: TrackMenuItemsProps): JSX.Element {
  return (
    <>
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
    </>
  );
}

export const PlayerContextMenu = forwardRef<HTMLDivElement, PlayerContextMenuProps>(
  function PlayerContextMenu(
    {
      position,
      initialized,
      hasMedia,
      hasVideo,
      isFsrEnabled,
      isAudioNormalizerEnabled,
      isStereoDownmixEnabled,
      isSvpAvailable,
      isSvpEnabled,
      isFullscreen,
      isModernInterfaceEnabled,
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
      toggleModernInterface,
      toggleFullscreen,
    },
    ref,
  ) {
    const [isPlaybackSubmenuOpen, setIsPlaybackSubmenuOpen] = useState(false);
    const [isAudioTracksSubmenuOpen, setIsAudioTracksSubmenuOpen] = useState(false);
    const [isSubtitleTracksSubmenuOpen, setIsSubtitleTracksSubmenuOpen] = useState(false);
    const isSubmenuOpenLeft =
      position.x + CONTEXT_MENU_WIDTH + CONTEXT_MENU_SUBMENU_WIDTH + 8 > window.innerWidth;

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
          disabled={!initialized}
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
        <EnhancementMenuItems
          hasMedia={hasMedia}
          hasVideo={hasVideo}
          isFsrEnabled={isFsrEnabled}
          isAudioNormalizerEnabled={isAudioNormalizerEnabled}
          isStereoDownmixEnabled={isStereoDownmixEnabled}
          isSvpAvailable={isSvpAvailable}
          isSvpEnabled={isSvpEnabled}
          toggleFsr={toggleFsr}
          toggleAudioNormalizer={toggleAudioNormalizer}
          toggleStereoDownmix={toggleStereoDownmix}
          toggleSvp={toggleSvp}
          runAction={runAction}
        />
        <div className="player-context-menu__separator" aria-hidden="true" />
        <TrackMenuItems
          hasMedia={hasMedia}
          hasVideo={hasVideo}
          audioTrackLabel={audioTrackLabel}
          subtitleTrackLabel={subtitleTrackLabel}
          audioTracks={audioTracks}
          subtitleTracks={subtitleTracks}
          selectAudioTrack={selectAudioTrack}
          selectSubtitleTrack={selectSubtitleTrack}
          isSubmenuOpenLeft={isSubmenuOpenLeft}
          isAudioTracksSubmenuOpen={isAudioTracksSubmenuOpen}
          isSubtitleTracksSubmenuOpen={isSubtitleTracksSubmenuOpen}
          runAction={runAction}
          setIsAudioTracksSubmenuOpen={setIsAudioTracksSubmenuOpen}
          setIsSubtitleTracksSubmenuOpen={setIsSubtitleTracksSubmenuOpen}
        />
        <div className="player-context-menu__separator" aria-hidden="true" />
        <InterfaceMenuItems
          isFullscreen={isFullscreen}
          isModernInterfaceEnabled={isModernInterfaceEnabled}
          runAction={runAction}
          toggleFullscreen={toggleFullscreen}
          toggleModernInterface={toggleModernInterface}
        />
      </div>
    );
  },
);
