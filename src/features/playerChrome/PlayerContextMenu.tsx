import { forwardRef, useCallback } from "react";
import { PlayerIcon } from "@features/player/ui/PlayerIcons";
import type { AsyncAction } from "@features/player/model/types";

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
  increaseSubtitleScale: AsyncAction;
  decreaseSubtitleScale: AsyncAction;
  cycleAudioTrack: AsyncAction;
  cycleSubtitleTrack: AsyncAction;
  toggleFsr: AsyncAction;
  toggleSvp: AsyncAction;
  toggleFullscreen: AsyncAction;
};

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
      increaseSubtitleScale,
      decreaseSubtitleScale,
      cycleAudioTrack,
      cycleSubtitleTrack,
      toggleFsr,
      toggleSvp,
      toggleFullscreen,
    },
    ref,
  ) {
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
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(speedUpPlayback);
          }}
        >
          <span className="player-context-menu__item-label">Speed Up</span>
          <span className="player-context-menu__item-shortcut">Ctrl+Right</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(slowDownPlayback);
          }}
        >
          <span className="player-context-menu__item-label">Slow Down</span>
          <span className="player-context-menu__item-shortcut">Ctrl+Left</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(zoomIn);
          }}
        >
          <span className="player-context-menu__item-label">Zoom In</span>
          <span className="player-context-menu__item-shortcut">Ctrl++</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(zoomOut);
          }}
        >
          <span className="player-context-menu__item-label">Zoom Out</span>
          <span className="player-context-menu__item-shortcut">Ctrl+-</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(increaseSubtitleScale);
          }}
        >
          <span className="player-context-menu__item-label">Increase Subtitle Size</span>
          <span className="player-context-menu__item-shortcut">Ctrl+Up</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(decreaseSubtitleScale);
          }}
        >
          <span className="player-context-menu__item-label">Decrease Subtitle Size</span>
          <span className="player-context-menu__item-shortcut">Ctrl+Down</span>
        </button>
        <button
          className="player-context-menu__item"
          type="button"
          role="menuitem"
          disabled={!hasMedia}
          onClick={(): void => {
            runAction(toggleFsr);
          }}
        >
          <span className="player-context-menu__item-label">Upscale</span>
          <span className="player-context-menu__item-meta">
            <span className="player-context-menu__item-shortcut">U</span>
            <span className="player-context-menu__item-icon" aria-hidden="true">
              {isFsrEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
            </span>
          </span>
        </button>
        {isSvpAvailable ? (
          <button
            className="player-context-menu__item"
            type="button"
            role="menuitemcheckbox"
            aria-checked={isSvpEnabled}
            onClick={(): void => {
              runAction(toggleSvp);
            }}
          >
            <span className="player-context-menu__item-label">Use Installed SVP</span>
            <span className="player-context-menu__item-icon" aria-hidden="true">
              {isSvpEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
            </span>
          </button>
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
          <span className="player-context-menu__item-label">Next Audio Track</span>
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
          <span className="player-context-menu__item-label">Next Subtitle Track</span>
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
