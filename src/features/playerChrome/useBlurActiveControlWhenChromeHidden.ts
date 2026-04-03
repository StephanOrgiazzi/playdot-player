import { useEffect } from "react";

export function useBlurActiveControlWhenChromeHidden(isChromeHidden: boolean): void {
  useEffect(() => {
    if (!isChromeHidden) {
      return;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return;
    }

    if (activeElement.closest(".control-dock, .titlebar")) {
      activeElement.blur();
    }
  }, [isChromeHidden]);
}
