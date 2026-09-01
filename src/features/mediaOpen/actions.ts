import { open } from "@tauri-apps/plugin-dialog";
import { Effect, Schema } from "effect";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getErrorMessage } from "@shared/lib/errorMessage";
import type { OpenWebUrlResult } from "./types";

const WEB_URL_PROTOCOLS = new Set(["http:", "https:"]);

class MediaLoadError extends Schema.TaggedErrorClass<MediaLoadError>()("MediaOpen.LoadError", {
  fallbackMessage: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return getErrorMessage(this.cause) ?? this.fallbackMessage;
  }
}

const loadMedia = Effect.fn("MediaOpen.load")(
  (
    player: MpvPlayer,
    source: string,
    fallbackMessage: string,
  ): Effect.Effect<void, MediaLoadError> =>
    Effect.tryPromise({
      try: () => player.loadFile(source),
      catch: (cause) => new MediaLoadError({ fallbackMessage, cause }),
    }),
);

const attemptMediaLoad = Effect.fn("MediaOpen.attemptLoad")(
  (
    player: MpvPlayer,
    source: string,
    fallbackMessage: string,
    setError: (value: string) => void,
  ): Effect.Effect<boolean> =>
    loadMedia(player, source, fallbackMessage).pipe(
      Effect.tap(() => Effect.sync(() => setError(""))),
      Effect.as(true),
      Effect.catch((error) =>
        Effect.sync(() => setError(error.message)).pipe(
          Effect.andThen(Effect.logError(error.fallbackMessage, error.cause)),
          Effect.as(false),
        ),
      ),
    ),
);

function normalizeWebUrl(value: string): string | null {
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
}: CreateMediaOpenActionsOptions) {
  const pickAndOpenMediaFile = async (): Promise<void> => {
    if (!player.getSnapshot().initialized) {
      return;
    }

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

    return withPlayerFocusRestore(() =>
      Effect.runPromise(
        attemptMediaLoad(player, picked, "Failed to play media file", setError).pipe(Effect.asVoid),
      ),
    );
  };

  const openWebUrl = async (rawUrl: string): Promise<OpenWebUrlResult> => {
    if (!player.getSnapshot().initialized || isOpeningPastedWebUrlRef.current) {
      return "failed";
    }

    const normalizedUrl = normalizeWebUrl(rawUrl);
    if (!normalizedUrl) {
      return "invalid";
    }

    isOpeningPastedWebUrlRef.current = true;

    const attempt = attemptMediaLoad(
      player,
      normalizedUrl,
      "Failed to play web URL",
      setError,
    ).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          isOpeningPastedWebUrlRef.current = false;
        }),
      ),
    );

    return withPlayerFocusRestore(() =>
      Effect.runPromise(attempt).then((opened): OpenWebUrlResult => (opened ? "opened" : "failed")),
    );
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
