import type { JSX } from "react";
import type { PlayerAction } from "@features/player/model/types";
import { PlayerIcon } from "@features/player/ui/PlayerIcons";
import { MenuActionItem } from "./MenuActionItem";

type InterfaceMenuItemsProps = {
  isFullscreen: boolean;
  isModernInterfaceEnabled: boolean;
  runAction: (action: PlayerAction) => void;
  toggleFullscreen: PlayerAction;
  toggleModernInterface: PlayerAction;
};

export function InterfaceMenuItems({
  isFullscreen,
  isModernInterfaceEnabled,
  runAction,
  toggleFullscreen,
  toggleModernInterface,
}: InterfaceMenuItemsProps): JSX.Element {
  return (
    <>
      <MenuActionItem
        label="Modern Interface"
        role="menuitemcheckbox"
        ariaChecked={isModernInterfaceEnabled}
        onClick={(): void => {
          runAction(toggleModernInterface);
        }}
        icon={
          isModernInterfaceEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null
        }
      />
      <MenuActionItem
        label={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
        shortcut="Alt+Enter"
        onClick={(): void => {
          runAction(toggleFullscreen);
        }}
      />
    </>
  );
}
