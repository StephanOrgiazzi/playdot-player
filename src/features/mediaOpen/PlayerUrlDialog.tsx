import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
  type SubmitEvent as ReactSubmitEvent,
} from "react";
import { Effect, Schema } from "effect";

type PlayerUrlDialogProps = {
  isOpen: boolean;
  isOpeningUrl: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  urlInputValue: string;
  urlDialogError: string;
  onInputChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

type InputContextMenuState = {
  x: number;
  y: number;
  selectionStart: number;
  selectionEnd: number;
};

class ClipboardError extends Schema.TaggedErrorClass<ClipboardError>()(
  "PlayerUrlDialog.ClipboardError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}`;
  }
}

const clipboardPromise = Effect.fn("PlayerUrlDialog.clipboard")(
  <A,>(operation: string, task: () => PromiseLike<A>): Effect.Effect<A, ClipboardError> =>
    Effect.tryPromise({
      try: task,
      catch: (cause) => new ClipboardError({ operation, cause }),
    }),
);

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
  const isOpenRef = useRef(isOpen);
  const interruptClipboardRef = useRef<(() => void) | null>(null);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (!isOpen) {
      setInputContextMenu(null);
      interruptClipboardRef.current?.();
      interruptClipboardRef.current = null;
    }

    return () => {
      interruptClipboardRef.current?.();
      interruptClipboardRef.current = null;
    };
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
    closeInputContextMenu();
    const selectedText = urlInputValue.slice(
      inputContextMenu.selectionStart,
      inputContextMenu.selectionEnd,
    );
    Effect.runCallback(
      clipboardPromise("copy URL text", () => navigator.clipboard.writeText(selectedText)).pipe(
        Effect.catch((error) => Effect.logError("PlayerUrlDialog.copy_failed", error)),
      ),
    );
  };

  const handlePaste = (): void => {
    if (inputContextMenu === null || isOpeningUrl) {
      return;
    }

    const { selectionStart, selectionEnd } = inputContextMenu;
    closeInputContextMenu();
    interruptClipboardRef.current?.();
    const paste = Effect.gen(function* () {
      const clipboardText = yield* clipboardPromise("read clipboard text", () =>
        navigator.clipboard.readText(),
      );
      yield* Effect.sync(() => {
        if (!isOpenRef.current) {
          return;
        }

        const nextValue =
          urlInputValue.slice(0, selectionStart) +
          clipboardText +
          urlInputValue.slice(selectionEnd);
        const cursorPosition = selectionStart + clipboardText.length;

        onInputChange(nextValue);
        window.requestAnimationFrame(() => {
          if (isOpenRef.current) {
            restoreInputSelection(cursorPosition, cursorPosition);
          }
        });
      });
    }).pipe(Effect.catch((error) => Effect.logError("PlayerUrlDialog.paste_failed", error)));
    interruptClipboardRef.current = Effect.runCallback(paste);
  };

  const handleSubmit = (event: ReactSubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
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
        onSubmit={handleSubmit}
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
