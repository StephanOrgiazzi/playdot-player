import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { OpenWebUrlResult } from "./types";

export function useOpenUrlDialog(openWebUrl: (url: string) => Promise<OpenWebUrlResult>): {
  isOpen: boolean;
  isOpening: boolean;
  urlInputValue: string;
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  open: () => Promise<void>;
  close: () => void;
  submit: () => Promise<void>;
  setUrlInputValue: (value: string) => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("https://");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback((): void => {
    if (isOpening) {
      return;
    }

    setIsOpen(false);
    setError("");
  }, [isOpening]);

  const open = useCallback(async (): Promise<void> => {
    setIsOpen(true);
    setIsOpening(false);
    setUrlInputValue("https://");
    setError("");
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    const enteredUrl = urlInputValue.trim();
    if (enteredUrl.length === 0) {
      setError("Enter a web URL.");
      return;
    }

    setIsOpening(true);
    setError("");

    const result = await openWebUrl(enteredUrl);
    setIsOpening(false);

    if (result === "opened") {
      setIsOpen(false);
      return;
    }

    if (result === "invalid") {
      setError("Use a full http:// or https:// URL.");
      return;
    }

    setError("Could not open that URL. Check it and try again.");
  }, [openWebUrl, urlInputValue]);

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
