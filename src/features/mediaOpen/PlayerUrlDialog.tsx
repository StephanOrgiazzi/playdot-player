import { type RefObject, type MouseEvent as ReactMouseEvent } from "react";

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
  if (!isOpen) {
    return null;
  }

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="url-dialog-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onContextMenu={(event): void => {
        event.preventDefault();
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
        <p className="url-dialog__copy">Paste a direct video link or stream URL.</p>
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
        />
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
