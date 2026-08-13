import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import { Effect, Schema } from "effect";
import { createSvpToast } from "@features/toaster/messages";
import type { ToastState } from "@features/toaster/types";
import type { MpvPlayer } from "@integrations/mpv/MpvPlayer";
import { getPersistedBoolean, persistBoolean } from "@shared/lib/persistedBoolean";

type SvpIntegrationState = {
  available: boolean;
  enabled: boolean;
};

type UseSvpIntegrationOptions = {
  player: MpvPlayer;
  setError: (value: string) => void;
  setToast: (value: ToastState) => void;
};

type UseSvpIntegrationResult = {
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  isSwitchingSvp: boolean;
  preparePlayerStart: () => Promise<void>;
  toggleSvp: () => Promise<void>;
};

const SVP_PREFERENCE_STORAGE_KEY = "playdot-player.player.svp-enabled";

class SvpToggleError extends Schema.TaggedErrorClass<SvpToggleError>()("Svp.ToggleError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return this.cause instanceof Error && this.cause.message
      ? this.cause.message
      : "Failed to toggle SVP";
  }
}

const applySvpToggle = Effect.fn("Svp.toggle")(
  (
    requestedEnabled: boolean,
    applyPreference: (enabled: boolean) => Promise<SvpIntegrationState>,
  ): Effect.Effect<SvpIntegrationState, SvpToggleError> =>
    Effect.tryPromise({
      try: () => applyPreference(requestedEnabled),
      catch: (cause) => new SvpToggleError({ cause }),
    }),
);

async function resolveSvpIntegration(requestedEnabled: boolean): Promise<SvpIntegrationState> {
  try {
    return await invoke<SvpIntegrationState>("resolve_svp_integration", {
      requestedEnabled,
    });
  } catch {
    return { available: false, enabled: false };
  }
}

export function useSvpIntegration({
  player,
  setError,
  setToast,
}: UseSvpIntegrationOptions): UseSvpIntegrationResult {
  const [svpPreferenceEnabled, setSvpPreferenceEnabled] = useState<boolean>(() =>
    getPersistedBoolean(SVP_PREFERENCE_STORAGE_KEY),
  );
  const [isSvpAvailable, setIsSvpAvailable] = useState(false);
  const [isSvpEnabled, setIsSvpEnabled] = useState(false);
  const [isSwitchingSvp, setIsSwitchingSvp] = useState(false);
  const isSwitchingSvpRef = useRef(false);

  const applySvpPreference = useCallback(
    async (requestedEnabled: boolean): Promise<SvpIntegrationState> => {
      const resolved = await resolveSvpIntegration(requestedEnabled);
      player.setSvpAvailable(resolved.available);
      await player.setSvpEnabled(resolved.enabled);
      setIsSvpAvailable(resolved.available);
      setIsSvpEnabled(resolved.enabled);
      return resolved;
    },
    [player],
  );

  const preparePlayerStart = useCallback(async (): Promise<void> => {
    await applySvpPreference(svpPreferenceEnabled);
  }, [applySvpPreference, svpPreferenceEnabled]);

  const toggleSvp = useCallback(async (): Promise<void> => {
    if (isSwitchingSvpRef.current) {
      return;
    }

    const nextPreferenceEnabled = !svpPreferenceEnabled;

    isSwitchingSvpRef.current = true;
    setIsSwitchingSvp(true);
    const toggle = applySvpToggle(nextPreferenceEnabled, applySvpPreference).pipe(
      Effect.tap((resolved) =>
        Effect.sync(() => {
          setError("");
          setSvpPreferenceEnabled(nextPreferenceEnabled);
          persistBoolean(SVP_PREFERENCE_STORAGE_KEY, nextPreferenceEnabled);
          setToast(createSvpToast(resolved.enabled));
        }),
      ),
      Effect.catch((error) =>
        Effect.sync(() => setError(error.message)).pipe(
          Effect.andThen(Effect.logError("Failed to toggle SVP", error.cause)),
        ),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          isSwitchingSvpRef.current = false;
          setIsSwitchingSvp(false);
        }),
      ),
    );

    await Effect.runPromise(toggle);
  }, [applySvpPreference, setError, setToast, svpPreferenceEnabled]);

  return {
    isSvpAvailable,
    isSvpEnabled,
    isSwitchingSvp,
    preparePlayerStart,
    toggleSvp,
  };
}
