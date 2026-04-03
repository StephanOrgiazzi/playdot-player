import { open } from "@tauri-apps/plugin-dialog";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/error";
import type { OpenWebUrlResult } from "./types";

const WEB_URL_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeWebUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmedValue);
    if (!WEB_URL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

type CreateMediaOpenActionsOptions = {
  player: MpvPlayer;
  setError: (value: string) => void;
  withPlayerFocusRestore: <T>(task: () => Promise<T>) => Promise<T>;
  isOpeningPastedWebUrlRef: { current: boolean };
};

export function createMediaOpenActions({
  player,
  setError,
  withPlayerFocusRestore,
  isOpeningPastedWebUrlRef,
}: CreateMediaOpenActionsOptions): {
  pickAndOpenMediaFile: () => Promise<void>;
  openWebUrl: (rawUrl: string) => Promise<OpenWebUrlResult>;
  openPastedWebUrl: (clipboardText: string) => Promise<void>;
} {
  const pickAndOpenMediaFile = async (): Promise<void> => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Media",
          extensions: ["mkv", "mp4", "mov", "webm", "avi", "m4v", "mp3", "flac", "wav", "aac"],
        },
      ],
    });

    if (!picked || Array.isArray(picked)) {
      return withPlayerFocusRestore(async () => undefined);
    }

    return withPlayerFocusRestore(async () => {
      try {
        await player.loadFile(picked);
        setError("");
      } catch (error) {
        setError(getErrorMessage(error, "Failed to play media file"));
      }
    });
  };

  const openWebUrl = async (rawUrl: string): Promise<OpenWebUrlResult> => {
    if (isOpeningPastedWebUrlRef.current) {
      return "failed";
    }

    const normalizedUrl = normalizeWebUrl(rawUrl);
    if (!normalizedUrl) {
      return "invalid";
    }

    isOpeningPastedWebUrlRef.current = true;

    return withPlayerFocusRestore(async () => {
      try {
        await player.loadFile(normalizedUrl);
        setError("");
        return "opened";
      } catch (error) {
        setError(getErrorMessage(error, "Failed to play web URL"));
        return "failed";
      } finally {
        isOpeningPastedWebUrlRef.current = false;
      }
    });
  };

  const openPastedWebUrl = async (clipboardText: string): Promise<void> => {
    await openWebUrl(clipboardText);
  };

  return {
    pickAndOpenMediaFile,
    openWebUrl,
    openPastedWebUrl,
  };
}
