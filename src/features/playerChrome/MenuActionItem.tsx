import type { JSX, ReactNode } from "react";

type MenuActionItemProps = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  role?: "menuitem" | "menuitemcheckbox";
  ariaChecked?: boolean;
  onClick: () => void;
  icon?: ReactNode;
};

export function MenuActionItem({
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
