import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Effect, Schema } from "effect";
import type { OpenWebUrlResult } from "./types";

class OpenUrlSubmissionError extends Schema.TaggedErrorClass<OpenUrlSubmissionError>()(
  "OpenUrlDialog.SubmissionError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not open that URL";
  }
}

const submitOpenUrl = Effect.fn("OpenUrlDialog.submit")(
  (
    openWebUrl: (url: string) => Promise<OpenWebUrlResult>,
    url: string,
  ): Effect.Effect<OpenWebUrlResult, OpenUrlSubmissionError> =>
    Effect.tryPromise({
      try: () => openWebUrl(url),
      catch: (cause) => new OpenUrlSubmissionError({ cause }),
    }),
);

export function useOpenUrlDialog(openWebUrl: (url: string) => Promise<OpenWebUrlResult>): {
  isOpen: boolean;
  isOpening: boolean;
  urlInputValue: string;
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  open: () => void;
  close: () => void;
  submit: () => void;
  setUrlInputValue: (value: string) => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("https://");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const interruptSubmissionRef = useRef<(() => void) | null>(null);

  const close = useCallback((): void => {
    if (isOpening) {
      return;
    }

    setIsOpen(false);
    setError("");
  }, [isOpening]);

  const open = useCallback((): void => {
    interruptSubmissionRef.current?.();
    interruptSubmissionRef.current = null;
    setIsOpen(true);
    setIsOpening(false);
    setUrlInputValue("https://");
    setError("");
  }, []);

  const submit = useCallback((): void => {
    const enteredUrl = urlInputValue.trim();
    if (enteredUrl.length === 0) {
      setError("Enter a web URL.");
      return;
    }

    setIsOpening(true);
    setError("");
    interruptSubmissionRef.current?.();

    const submission = submitOpenUrl(openWebUrl, enteredUrl).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          setIsOpening(false);
          if (result === "opened") {
            setIsOpen(false);
          } else if (result === "invalid") {
            setError("Use a full http:// or https:// URL.");
          } else {
            setError("Could not open that URL. Check it and try again.");
          }
        }),
      ),
      Effect.catch((failure) =>
        Effect.sync(() => {
          setIsOpening(false);
          setError("Could not open that URL. Check it and try again.");
        }).pipe(Effect.andThen(Effect.logError("OpenUrlDialog.submit_failed", failure))),
      ),
    );

    interruptSubmissionRef.current = Effect.runCallback(submission);
  }, [openWebUrl, urlInputValue]);

  useEffect(
    () => () => {
      interruptSubmissionRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen]);

  return {
    isOpen,
    isOpening,
    urlInputValue,
    error,
    inputRef,
    open,
    close,
    submit,
    setUrlInputValue,
  };
}
