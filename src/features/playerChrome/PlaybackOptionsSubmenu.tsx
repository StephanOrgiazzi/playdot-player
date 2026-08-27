import type { Dispatch, JSX, SetStateAction, WheelEvent } from "react";
import type { PlayerAction } from "@features/player/model/types";
import { MenuActionItem } from "./MenuActionItem";
import { useSubmenuViewportStyle } from "./useSubmenuViewportStyle";

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

function keepWheelInsideSubmenu(event: WheelEvent<HTMLDivElement>): void {
  event.stopPropagation();
}

export function PlaybackOptionsSubmenu({
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
                onClick={(): void => runAction(zoomIn)}
              />
              <MenuActionItem
                label="Zoom Out"
                shortcut="Ctrl+-"
                onClick={(): void => runAction(zoomOut)}
              />
              <MenuActionItem
                label="Increase Gamma"
                shortcut="Alt+Right"
                onClick={(): void => runAction(increaseGamma)}
              />
              <MenuActionItem
                label="Decrease Gamma"
                shortcut="Alt+Left"
                onClick={(): void => runAction(decreaseGamma)}
              />
              <MenuActionItem
                label="Increase Subtitle Size"
                shortcut="Ctrl+Up"
                onClick={(): void => runAction(increaseSubtitleScale)}
              />
              <MenuActionItem
                label="Decrease Subtitle Size"
                shortcut="Ctrl+Down"
                onClick={(): void => runAction(decreaseSubtitleScale)}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
