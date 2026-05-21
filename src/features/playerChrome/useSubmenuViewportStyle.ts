import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { CONTEXT_MENU_MARGIN } from "./constants";

export function useSubmenuViewportStyle(isOpen: boolean): {
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle: CSSProperties;
} {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      setPanelStyle({});
      return;
    }

    const updatePanelPosition = (): void => {
      const panel = panelRef.current;
      const submenuGroup = panel?.parentElement;
      if (!panel || !submenuGroup) {
        return;
      }

      const submenuGroupRect = submenuGroup.getBoundingClientRect();
      const maxHeight = Math.max(120, window.innerHeight - CONTEXT_MENU_MARGIN * 2);
      const panelHeight = Math.min(panel.scrollHeight, maxHeight);
      const baseTop = -6;
      let top = baseTop;

      const panelViewportTop = submenuGroupRect.top + top;
      const bottomOverflow =
        panelViewportTop + panelHeight - (window.innerHeight - CONTEXT_MENU_MARGIN);
      if (bottomOverflow > 0) {
        top -= bottomOverflow;
      }

      const topOverflow = CONTEXT_MENU_MARGIN - (submenuGroupRect.top + top);
      if (topOverflow > 0) {
        top += topOverflow;
      }

      setPanelStyle({
        maxHeight: `${Math.round(maxHeight)}px`,
        top: `${Math.round(top)}px`,
      });
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [isOpen]);

  return { panelRef, panelStyle };
}
