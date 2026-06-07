import {
  useEffect,
  useState,
  type CSSProperties,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from "react";

type PlayerUrlDialogProps = {
  isOpen: boolean;
  isOpeningUrl: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  urlInputValue: string;
  urlDialogError: string;
  onInputChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
};

type InputContextMenuState = {
  x: number;
  y: number;
  selectionStart: number;
  selectionEnd: number;
};

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

async function readClipboardText(): Promise<string> {
  return navigator.clipboard.readText();
}

function getClampedMenuPosition(event: ReactMouseEvent<HTMLInputElement>): {
  x: number;
  y: number;
} {
  const menuWidth = 148;
  const menuHeight = 72;
  const viewportPadding = 8;
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding);
  const y = Math.min(event.clientY, window.innerHeight - menuHeight - viewportPadding);

  return {
    x: Math.max(viewportPadding, x),
    y: Math.max(viewportPadding, y),
  };
}

export function PlayerUrlDialog({
  isOpen,
  isOpeningUrl,
  inputRef,
  urlInputValue,
  urlDialogError,
  onInputChange,
  onClose,
  onSubmit,
}: PlayerUrlDialogProps) {
  const [inputContextMenu, setInputContextMenu] = useState<InputContextMenuState | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInputContextMenu(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const hasSelection =
    inputContextMenu !== null && inputContextMenu.selectionEnd > inputContextMenu.selectionStart;

  const closeInputContextMenu = (): void => {
    setInputContextMenu(null);
  };

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    closeInputContextMenu();

    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const restoreInputSelection = (selectionStart: number, selectionEnd: number): void => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(selectionStart, selectionEnd);
  };

  const handleInputContextMenu = (event: ReactMouseEvent<HTMLInputElement>): void => {
    event.preventDefault();
    event.stopPropagation();

    const { x, y } = getClampedMenuPosition(event);
    setInputContextMenu({
      x,
      y,
      selectionStart: event.currentTarget.selectionStart ?? 0,
      selectionEnd: event.currentTarget.selectionEnd ?? 0,
    });
  };

  const handleCopy = (): void => {
    if (inputContextMenu === null || !hasSelection) {
      return;
    }

    restoreInputSelection(inputContextMenu.selectionStart, inputContextMenu.selectionEnd);
    void copyText(
      urlInputValue.slice(inputContextMenu.selectionStart, inputContextMenu.selectionEnd),
    ).catch(() => undefined);
    closeInputContextMenu();
  };

  const handlePaste = (): void => {
    if (inputContextMenu === null || isOpeningUrl) {
      return;
    }

    const { selectionStart, selectionEnd } = inputContextMenu;
    closeInputContextMenu();
    void readClipboardText()
      .then((clipboardText) => {
        const nextValue =
          urlInputValue.slice(0, selectionStart) +
          clipboardText +
          urlInputValue.slice(selectionEnd);
        const cursorPosition = selectionStart + clipboardText.length;

        onInputChange(nextValue);
        window.requestAnimationFrame(() => {
          restoreInputSelection(cursorPosition, cursorPosition);
        });
      })
      .catch(() => undefined);
  };

  const inputContextMenuStyle: CSSProperties | undefined =
    inputContextMenu === null
      ? undefined
      : { left: `${inputContextMenu.x}px`, top: `${inputContextMenu.y}px` };

  return (
    <div
      className="url-dialog-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onContextMenu={(event): void => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
        }
      }}
    >
      <form
        className="url-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="url-dialog-title"
        onSubmit={(event): void => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <h2 id="url-dialog-title" className="url-dialog__title">
          Open Web URL
        </h2>
        <p className="url-dialog__copy">Paste a direct media link or stream URL.</p>
        <label className="url-dialog__label" htmlFor="url-dialog-input">
          URL
        </label>
        <input
          id="url-dialog-input"
          ref={inputRef}
          className="url-dialog__input"
          type="url"
          value={urlInputValue}
          autoComplete="off"
          spellCheck={false}
          disabled={isOpeningUrl}
          onChange={(event): void => {
            onInputChange(event.currentTarget.value);
          }}
          onContextMenu={handleInputContextMenu}
        />
        {inputContextMenu ? (
          <div
            className="url-input-context-menu"
            role="menu"
            style={inputContextMenuStyle}
            onMouseDown={(event): void => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onContextMenu={(event): void => {
              event.preventDefault();
            }}
          >
            <button
              className="url-input-context-menu__item"
              type="button"
              role="menuitem"
              disabled={!hasSelection}
              onClick={handleCopy}
            >
              Copier
            </button>
            <button
              className="url-input-context-menu__item"
              type="button"
              role="menuitem"
              disabled={isOpeningUrl}
              onClick={handlePaste}
            >
              Coller
            </button>
          </div>
        ) : null}
        {urlDialogError && (
          <p className="url-dialog__error" role="alert">
            {urlDialogError}
          </p>
        )}
        <div className="url-dialog__actions">
          <button
            className="url-dialog__button url-dialog__button--ghost"
            type="button"
            disabled={isOpeningUrl}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="url-dialog__button url-dialog__button--primary"
            type="submit"
            disabled={isOpeningUrl}
          >
            {isOpeningUrl ? "Opening..." : "Open URL"}
          </button>
        </div>
      </form>
    </div>
  );
}
