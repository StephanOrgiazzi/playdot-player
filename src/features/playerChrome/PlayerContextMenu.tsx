import { forwardRef, useCallback, useState, type Dispatch, type JSX, type ReactNode, type SetStateAction } from "react";
import { PlayerIcon } from "@features/player/ui/PlayerIcons";
import type { AsyncAction } from "@features/player/model/types";
import { CONTEXT_MENU_SUBMENU_WIDTH, CONTEXT_MENU_WIDTH } from "./constants";

type PlayerContextMenuProps = {
  position: { x: number; y: number };
  hasMedia: boolean;
  isFsrEnabled: boolean;
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  showOpenUrlDialog: AsyncAction;
  slowDownPlayback: AsyncAction;
  speedUpPlayback: AsyncAction;
  zoomIn: AsyncAction;
  zoomOut: AsyncAction;
  increaseGamma: AsyncAction;
  decreaseGamma: AsyncAction;
  increaseSubtitleScale: AsyncAction;
  decreaseSubtitleScale: AsyncAction;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  cycleAudioTrack: AsyncAction;
  cycleSubtitleTrack: AsyncAction;
  toggleFsr: AsyncAction;
  toggleSvp: AsyncAction;
  toggleFullscreen: AsyncAction;
};

type MenuActionItemProps = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  role?: "menuitem" | "menuitemcheckbox";
  ariaChecked?: boolean;
  onClick: () => void;
  icon?: ReactNode;
};

function MenuActionItem({
  label,
  shortcut,
  disabled,
  role = "menuitem",
  ariaChecked,
  onClick,
  icon,
}: MenuActionItemProps): JSX.Element {
  let metaContent: JSX.Element | null = null;
  if (icon) {
    metaContent = (
      <span className="player-context-menu__item-meta">
        {shortcut ? <span className="player-context-menu__item-shortcut">{shortcut}</span> : null}
        <span className="player-context-menu__item-icon" aria-hidden="true">
          {icon}
        </span>
      </span>
    );
  } else if (shortcut) {
    metaContent = <span className="player-context-menu__item-shortcut">{shortcut}</span>;
  }

  return (
    <button
      className="player-context-menu__item"
      type="button"
      role={role}
      disabled={disabled}
      aria-checked={ariaChecked}
      onClick={onClick}
    >
      <span className="player-context-menu__item-label">{label}</span>
      {metaContent}
    </button>
  );
}

type PlaybackOptionsSubmenuProps = {
  hasMedia: boolean;
  isSubmenuOpenLeft: boolean;
  isPlaybackSubmenuOpen: boolean;
  runAction: (action: AsyncAction) => void;
  setIsPlaybackSubmenuOpen: Dispatch<SetStateAction<boolean>>;
  speedUpPlayback: AsyncAction;
  slowDownPlayback: AsyncAction;
  zoomIn: AsyncAction;
  zoomOut: AsyncAction;
  increaseGamma: AsyncAction;
  decreaseGamma: AsyncAction;
  increaseSubtitleScale: AsyncAction;
  decreaseSubtitleScale: AsyncAction;
};

function PlaybackOptionsSubmenu({
  hasMedia,
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
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
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
          className={`player-context-menu__submenu-panel${isSubmenuOpenLeft ? " is-open-left" : ""}`}
          role="menu"
        >
          <MenuActionItem
            label="Speed Up"
            shortcut="Ctrl+Right"
            disabled={!hasMedia}
            onClick={(): void => runAction(speedUpPlayback)}
          />
          <MenuActionItem
            label="Slow Down"
            shortcut="Ctrl+Left"
            disabled={!hasMedia}
            onClick={(): void => runAction(slowDownPlayback)}
          />
          <MenuActionItem
            label="Zoom In"
            shortcut="Ctrl++"
            disabled={!hasMedia}
            onClick={(): void => runAction(zoomIn)}
          />
          <MenuActionItem
            label="Zoom Out"
            shortcut="Ctrl+-"
            disabled={!hasMedia}
            onClick={(): void => runAction(zoomOut)}
          />
          <MenuActionItem
            label="Increase Gamma"
            shortcut="Alt+Right"
            disabled={!hasMedia}
            onClick={(): void => runAction(increaseGamma)}
          />
          <MenuActionItem
            label="Decrease Gamma"
            shortcut="Alt+Left"
            disabled={!hasMedia}
            onClick={(): void => runAction(decreaseGamma)}
          />
          <MenuActionItem
            label="Increase Subtitle Size"
            shortcut="Ctrl+Up"
            disabled={!hasMedia}
            onClick={(): void => runAction(increaseSubtitleScale)}
          />
          <MenuActionItem
            label="Decrease Subtitle Size"
            shortcut="Ctrl+Down"
            disabled={!hasMedia}
            onClick={(): void => runAction(decreaseSubtitleScale)}
          />
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
      isFsrEnabled,
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
      cycleAudioTrack,
      cycleSubtitleTrack,
      toggleFsr,
      toggleSvp,
      toggleFullscreen,
    },
    ref,
  ) {
    const [isPlaybackSubmenuOpen, setIsPlaybackSubmenuOpen] = useState(false);
    const isSubmenuOpenLeft =
      typeof window === "undefined"
        ? false
        : position.x + CONTEXT_MENU_WIDTH + CONTEXT_MENU_SUBMENU_WIDTH + 8 > window.innerWidth;

    const runAction = useCallback(
      (action: AsyncAction): void => {
        onClose();
        void action();
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
        <MenuActionItem
          label="Upscale"
          shortcut="U"
          disabled={!hasMedia}
          onClick={(): void => runAction(toggleFsr)}
          icon={isFsrEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
        />
        {isSvpAvailable ? (
          <MenuActionItem
            label="Use Installed SVP"
            role="menuitemcheckbox"
            ariaChecked={isSvpEnabled}
            disabled={!hasMedia}
            onClick={(): void => runAction(toggleSvp)}
            icon={isSvpEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
          />
        ) : null}
        <div className="player-context-menu__separator" aria-hidden="true" />
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(cycleAudioTrack);
          }}
        >
          <span className="player-context-menu__item-label">{audioTrackLabel}</span>
          <span className="player-context-menu__item-shortcut">A</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(cycleSubtitleTrack);
          }}
        >
          <span className="player-context-menu__item-label">{subtitleTrackLabel}</span>
          <span className="player-context-menu__item-shortcut">S</span>
        </button>
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
