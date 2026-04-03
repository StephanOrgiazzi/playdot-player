import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import {
  CONTEXT_MENU_HEIGHT,
  CONTEXT_MENU_MARGIN,
  CONTEXT_MENU_WIDTH,
} from "./constants";
import type { ContextMenuPosition } from "./types";

function getContextMenuPosition(clientX: number, clientY: number): ContextMenuPosition {
  const x = Math.max(
    CONTEXT_MENU_MARGIN,
    Math.min(clientX, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN),
  );
  const y = Math.max(
    CONTEXT_MENU_MARGIN,
    Math.min(clientY, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN),
  );

  return { x, y };
}

export function useStageContextMenu(isDisabled: boolean): {
  contextMenuPosition: ContextMenuPosition | null;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  closeContextMenu: () => void;
  handleStageContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
} {
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const closeContextMenu = useCallback((): void => {
    setContextMenuPosition(null);
  }, []);

  const handleStageContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>): void => {
      event.preventDefault();
      if (isDisabled) {
        return;
      }

      setContextMenuPosition(getContextMenuPosition(event.clientX, event.clientY));
    },
    [isDisabled],
  );

  useEffect(() => {
    if (!contextMenuPosition) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node) || !contextMenuRef.current?.contains(target)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeContextMenu);
    window.addEventListener("resize", closeContextMenu);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", closeContextMenu);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [closeContextMenu, contextMenuPosition]);

  return {
    contextMenuPosition,
    contextMenuRef,
    closeContextMenu,
    handleStageContextMenu,
  };
}
