import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { MediaTrack } from "@features/player/model/playerState";
import { createTrackToast } from "./messages";
import type { ToastState, TrackKind } from "./types";

const TOAST_HIDE_DELAY_MS = 1400;

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export function useToastAutoHide(
  toast: ToastState | null,
  setToast: StateSetter<ToastState | null>,
): void {
  useEffect(() => {
    if (!toast?.visible) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast((current) => (current ? { ...current, visible: false } : null));
    }, TOAST_HIDE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [setToast, toast]);
}

type UsePendingTrackToastOptions = {
  pendingTrackToast: TrackKind | null;
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  selectedAudioTrack: MediaTrack | undefined;
  selectedSubtitleTrack: MediaTrack | undefined;
  setToast: StateSetter<ToastState | null>;
  setPendingTrackToast: StateSetter<TrackKind | null>;
};

export function usePendingTrackToast({
  pendingTrackToast,
  audioTracks,
  subtitleTracks,
  selectedAudioTrack,
  selectedSubtitleTrack,
  setToast,
  setPendingTrackToast,
}: UsePendingTrackToastOptions): void {
  useEffect(() => {
    if (!pendingTrackToast) {
      return;
    }

    if (pendingTrackToast === "audio") {
      setToast(createTrackToast("audio", audioTracks, selectedAudioTrack));
    } else {
      setToast(createTrackToast("subtitles", subtitleTracks, selectedSubtitleTrack));
    }

    setPendingTrackToast(null);
  }, [
    audioTracks,
    pendingTrackToast,
    selectedAudioTrack,
    selectedSubtitleTrack,
    setPendingTrackToast,
    setToast,
    subtitleTracks,
  ]);
}
