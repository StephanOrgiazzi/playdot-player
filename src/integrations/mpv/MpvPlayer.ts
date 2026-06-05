import {
  command,
  destroy,
  init,
  listenEvents,
  observeProperties,
  setVideoMarginRatio,
  setProperty,
} from "./libmpv-api";
import {
  AUDIO_ARTWORK_HIDDEN_VIDEO_MARGIN_RATIO,
  isLikelyAudioSource,
  nextAnimationFrame,
  readAudioArtworkUrl,
} from "./audioArtwork";
import { normalizePlaybackSpeed } from "./playback";
import {
  DEFAULT_PLAYBACK_SPEED,
  OBSERVED_PROPERTIES,
  SUBTITLE_SCALE,
  clampMpvVolume,
} from "./constants";
import { createMpvConfig, getMpvResourcePaths } from "./config";
import { MpvThumbnailer } from "./MpvThumbnailer";
import { applyObservedProperty } from "./stateUpdates";
import {
  EMPTY_PLAYER_STATE,
  type MediaTrack,
  type PlayerState,
} from "@features/player/model/playerState";
import { getSelectedTrackByType, getTracksByType } from "@features/player/model/playerSelectors";
import { toError } from "@shared/lib/error";

type PlayerListener = (state: PlayerState) => void;
type TrackSelection = number | "no";

export class MpvPlayer {
  private state: PlayerState = { ...EMPTY_PLAYER_STATE };
  private thumbnailer = new MpvThumbnailer();

  private listeners = new Set<PlayerListener>();
  private emitFrameId: number | null = null;
  private unlisten: (() => void) | null = null;
  private audioTrackChange: Promise<void> | null = null;
  private subtitleTrackChange: Promise<void> | null = null;
  private fsrToggle: Promise<boolean> | null = null;
  private upscaleShaderBundles: string[][] = [];
  private appliedUpscaleShaderPaths: string[] = [];
  private stereoDownmixEnabled = false;
  private svpEnabled = false;
  private started = false;
  private currentSource: string | null = null;
  private artworkCaptureToken = 0;

  private clearPendingEmit(): void {
    if (this.emitFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.emitFrameId);
    this.emitFrameId = null;
  }

  private emit(): void {
    if (this.emitFrameId !== null) {
      return;
    }

    this.emitFrameId = window.requestAnimationFrame(() => {
      this.emitFrameId = null;

      for (const listener of this.listeners) {
        listener(this.state);
      }
    });
  }

  private emitImmediately(): void {
    this.clearPendingEmit();
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private async setPlayerFlag(name: "pause" | "mute", value: boolean): Promise<void> {
    this.state = { ...this.state, [name === "pause" ? "paused" : "mute"]: value };
    this.emit();
    await setProperty(name, value);
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  subscribeThumbnail = (listener: (url: string) => void): (() => void) =>
    this.thumbnailer.subscribe(listener);

  requestThumbnail = this.thumbnailer.request.bind(this.thumbnailer);

  clearThumbnail = this.thumbnailer.clear.bind(this.thumbnailer);

  async start(): Promise<void> {
    await this.initialize();
  }

  async stop(): Promise<void> {
    const shouldDestroy = this.started || this.unlisten !== null;

    this.clearPendingEmit();
    this.unlisten?.();
    this.unlisten = null;
    this.fsrToggle = null;
    this.upscaleShaderBundles = [];
    this.appliedUpscaleShaderPaths = [];
    this.started = false;
    this.currentSource = null;
    this.artworkCaptureToken += 1;

    if (!shouldDestroy) {
      return;
    }

    await Promise.all([destroy().catch(() => undefined), this.thumbnailer.stop()]);
  }

  async setSvpEnabled(enabled: boolean): Promise<void> {
    if (this.svpEnabled === enabled) {
      return;
    }

    const previous = this.svpEnabled;
    this.svpEnabled = enabled;

    if (!this.started) {
      return;
    }

    try {
      await this.restartWithCurrentMedia();
    } catch (error) {
      this.svpEnabled = previous;
      throw error;
    }
  }

  async setStereoDownmixEnabled(enabled: boolean): Promise<void> {
    if (this.stereoDownmixEnabled === enabled) {
      return;
    }

    const previous = this.stereoDownmixEnabled;
    this.stereoDownmixEnabled = enabled;

    if (!this.started) {
      return;
    }

    try {
      await this.applyStereoDownmixSettings(enabled);
    } catch (error) {
      this.stereoDownmixEnabled = previous;
      throw error;
    }
  }

  async loadFile(path: string, updateThumbnailSource = true): Promise<void> {
    this.currentSource = path;
    const isAudioSource = isLikelyAudioSource(path);
    const audioArtworkUrl = isAudioSource ? await readAudioArtworkUrl(path).catch(() => "") : "";

    this.thumbnailer.setSource(updateThumbnailSource && !isAudioSource ? path : null);
    this.prepareAudioArtworkLoad(audioArtworkUrl);
    if (audioArtworkUrl) {
      await setVideoMarginRatio(AUDIO_ARTWORK_HIDDEN_VIDEO_MARGIN_RATIO).catch(() => undefined);
      await nextAnimationFrame();
    } else {
      await setVideoMarginRatio({ left: 0, right: 0, top: 0, bottom: 0 }).catch(() => undefined);
    }

    await command("loadfile", [path]);
    await this.resetPerMediaDefaults();

    await this.play();
  }

  async togglePlayPause(): Promise<void> {
    await this.setPlayerFlag("pause", !this.state.paused);
  }

  async play(): Promise<void> {
    await this.setPlayerFlag("pause", false);
  }

  async pause(): Promise<void> {
    await this.setPlayerFlag("pause", true);
  }

  async seekAbsolute(seconds: number): Promise<void> {
    await command("seek", [Math.max(0, seconds), "absolute+exact"]);
  }

  async seekRelative(seconds: number): Promise<void> {
    await command("seek", [seconds, "relative"]);
  }

  async frameStep(): Promise<void> {
    await command("frame-step");
  }

  private async initialize(): Promise<void> {
    if (this.started || this.unlisten) {
      await destroy().catch(() => undefined);
    }

    const resourcePaths = await getMpvResourcePaths();
    const config = await createMpvConfig(resourcePaths, {
      stereoDownmixEnabled: this.stereoDownmixEnabled,
      svpEnabled: this.svpEnabled,
    });
    await init(config);
    this.upscaleShaderBundles = resourcePaths.upscaleShaderBundles;
    this.appliedUpscaleShaderPaths = [];
    this.started = true;

    this.state = { ...this.state, initialized: true };
    this.emit();

    this.unlisten = await observeProperties(OBSERVED_PROPERTIES, (event) => {
      this.thumbnailer.setVideoParam(event.name, event.data);

      const nextState = applyObservedProperty(this.state, event);
      if (nextState === this.state) {
        return;
      }

      this.state = nextState;
      this.emit();
    });
  }

  private prepareAudioArtworkLoad(audioArtworkUrl: string): void {
    this.artworkCaptureToken += 1;
    const isAudioArtworkActive = audioArtworkUrl.length > 0;
    const nextState = {
      ...this.state,
      isAudioArtworkActive,
      audioArtworkUrl,
    };

    if (
      nextState.isAudioArtworkActive === this.state.isAudioArtworkActive &&
      nextState.audioArtworkUrl === this.state.audioArtworkUrl
    ) {
      return;
    }

    this.state = nextState;
    this.emitImmediately();
  }

  async setVolume(volume: number): Promise<void> {
    const nextVolume = clampMpvVolume(volume);
    const wasMuted = this.state.mute;
    const nextMute = nextVolume > 0 ? false : this.state.mute;

    if (nextVolume !== this.state.volume || nextMute !== this.state.mute) {
      this.state = {
        ...this.state,
        volume: nextVolume,
        mute: nextMute,
      };
      this.emit();
    }

    if (nextVolume > 0 && wasMuted) {
      await setProperty("mute", false);
    }

    await setProperty("volume", nextVolume);
  }

  async toggleMute(): Promise<void> {
    await this.setPlayerFlag("mute", !this.state.mute);
  }

  async adjustVolume(delta: number): Promise<void> {
    await this.setVolume(this.state.volume + delta);
  }

  getVolume(): number {
    return this.state.volume;
  }

  getIsMuted(): boolean {
    return this.state.mute;
  }

  async adjustPlaybackSpeed(multiplier: number): Promise<number> {
    const currentSpeed = this.state.playbackSpeed || DEFAULT_PLAYBACK_SPEED;
    const nextSpeed = normalizePlaybackSpeed(currentSpeed * multiplier);

    if (nextSpeed !== this.state.playbackSpeed) {
      this.state = { ...this.state, playbackSpeed: nextSpeed };
      this.emit();
    }

    await setProperty("speed", nextSpeed);
    return nextSpeed;
  }

  async adjustVideoZoom(delta: number): Promise<void> {
    await command("add", ["video-zoom", delta]);
  }

  async adjustSubtitleScale(delta: number): Promise<void> {
    await command("add", ["sub-scale", delta]);
  }

  async adjustGamma(delta: number): Promise<void> {
    await command("add", ["gamma", delta]);
  }

  async setAudioTrack(id: number | "no"): Promise<void> {
    await command("set", ["aid", String(id)]);
  }

  async setSubtitleTrack(id: number | "no"): Promise<void> {
    await command("set", ["sid", String(id)]);
  }

  async cycleAudioTrack(): Promise<void> {
    if (this.audioTrackChange) {
      return this.audioTrackChange;
    }

    const task = this.runAudioTrackCycle().finally(() => {
      if (this.audioTrackChange === task) {
        this.audioTrackChange = null;
      }
    });

    this.audioTrackChange = task;
    return task;
  }

  async cycleSubtitleTrack(): Promise<void> {
    if (this.subtitleTrackChange) {
      return this.subtitleTrackChange;
    }

    const task = this.runSubtitleTrackCycle().finally(() => {
      if (this.subtitleTrackChange === task) {
        this.subtitleTrackChange = null;
      }
    });

    this.subtitleTrackChange = task;
    return task;
  }

  async toggleFsr(): Promise<boolean> {
    if (this.fsrToggle) {
      return this.fsrToggle;
    }

    const task = this.runFsrToggle().finally(() => {
      if (this.fsrToggle === task) {
        this.fsrToggle = null;
      }
    });

    this.fsrToggle = task;
    return task;
  }

  private async runAudioTrackCycle(): Promise<void> {
    const audioTracks = getTracksByType(this.state, "audio");
    if (audioTracks.length < 2) {
      return;
    }

    const selectedTrack = getSelectedTrackByType(this.state, "audio");
    const selectedIndex = selectedTrack
      ? audioTracks.findIndex((track) => track.id === selectedTrack.id)
      : -1;
    const nextTrack = audioTracks[(selectedIndex + 1 + audioTracks.length) % audioTracks.length];
    if (!nextTrack) {
      return;
    }

    if (nextTrack.id === selectedTrack?.id) {
      return;
    }

    await this.setAudioTrack(nextTrack.id);
    await this.waitForTrackSelection("audio", nextTrack.id);
  }

  private async runSubtitleTrackCycle(): Promise<void> {
    const subtitleTracks = getTracksByType(this.state, "sub");
    if (subtitleTracks.length === 0) {
      return;
    }

    const selectedTrack = getSelectedTrackByType(this.state, "sub");

    if (!selectedTrack) {
      const firstSubtitleTrack = subtitleTracks[0];
      if (!firstSubtitleTrack) {
        return;
      }

      await this.setSubtitleTrack(firstSubtitleTrack.id);
      await this.waitForTrackSelection("sub", firstSubtitleTrack.id);
      return;
    }

    const selectedIndex = subtitleTracks.findIndex((track) => track.id === selectedTrack.id);
    const nextSubtitleTrack = subtitleTracks[selectedIndex + 1];
    const nextSelection: TrackSelection =
      selectedIndex >= subtitleTracks.length - 1 || !nextSubtitleTrack
        ? "no"
        : nextSubtitleTrack.id;

    await this.setSubtitleTrack(nextSelection);
    await this.waitForTrackSelection("sub", nextSelection);
  }

  private async runFsrToggle(): Promise<boolean> {
    if (this.appliedUpscaleShaderPaths.length > 0) {
      for (const shaderPath of [...this.appliedUpscaleShaderPaths].reverse()) {
        await command("change-list", ["glsl-shaders", "remove", shaderPath]);
      }
      this.appliedUpscaleShaderPaths = [];
      return false;
    }

    const shaderPaths = await this.enableFsr();
    if (!shaderPaths) {
      throw new Error("FSR shader resource is unavailable");
    }

    return true;
  }

  private async enableFsr(): Promise<string[] | null> {
    const preferredBundle = this.appliedUpscaleShaderPaths;
    const orderedBundles =
      preferredBundle.length > 0
        ? [
            preferredBundle,
            ...this.upscaleShaderBundles.filter(
              (bundle) => bundle.join("\n") !== preferredBundle.join("\n"),
            ),
          ]
        : this.upscaleShaderBundles;
    let lastError: Error | null = null;

    for (const bundle of orderedBundles) {
      const appliedBundlePaths: string[] = [];
      try {
        for (const shaderPath of bundle) {
          await command("change-list", ["glsl-shaders", "append", shaderPath]);
          appliedBundlePaths.push(shaderPath);
        }

        this.appliedUpscaleShaderPaths = appliedBundlePaths;
        return appliedBundlePaths;
      } catch (error) {
        lastError = toError(error);
        for (const shaderPath of [...appliedBundlePaths].reverse()) {
          await command("change-list", ["glsl-shaders", "remove", shaderPath]).catch(
            () => undefined,
          );
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }

  private async applyStereoDownmixSettings(enabled: boolean): Promise<void> {
    await setProperty("audio-channels", enabled ? "stereo" : "auto-safe");
    await setProperty("ad-lavc-downmix", enabled ? "yes" : "no");
    await setProperty("audio-normalize-downmix", "yes");
  }

  private async waitForTrackSelection(
    type: MediaTrack["type"],
    target: TrackSelection,
  ): Promise<void> {
    if (this.matchesTrackSelection(type, target)) {
      return;
    }

    await new Promise<void>((resolve) => {
      let unsubscribe: (() => void) | null = null;
      const timeout = globalThis.setTimeout(() => {
        unsubscribe?.();
        resolve();
      }, 700);

      unsubscribe = this.subscribe(() => {
        if (!this.matchesTrackSelection(type, target)) {
          return;
        }

        globalThis.clearTimeout(timeout);
        unsubscribe?.();
        resolve();
      });
    });
  }

  private matchesTrackSelection(type: MediaTrack["type"], target: TrackSelection): boolean {
    const selectedTrack = getSelectedTrackByType(this.state, type);

    if (target === "no") {
      return selectedTrack === undefined;
    }

    return selectedTrack?.id === target;
  }

  private async waitForEvent(eventName: string, timeoutMs = 5000): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let unlisten: (() => void) | null = null;

      const finish = (matched: boolean): void => {
        if (settled) {
          return;
        }

        settled = true;
        globalThis.clearTimeout(timeout);
        unlisten?.();
        resolve(matched);
      };

      const timeout = globalThis.setTimeout(() => {
        finish(false);
      }, timeoutMs);

      void listenEvents((event) => {
        if (event.event === eventName) {
          finish(true);
        }
      })
        .then((nextUnlisten) => {
          if (settled) {
            nextUnlisten();
            return;
          }

          unlisten = nextUnlisten;
        })
        .catch(() => {
          finish(false);
        });
    });
  }

  private async resetPerMediaDefaults(): Promise<void> {
    await setProperty("sub-scale", SUBTITLE_SCALE);
    await setProperty("gamma", 1);
  }

  private async restartWithCurrentMedia(): Promise<void> {
    const currentSource = this.currentSource;
    const currentTime = this.state.timePos;
    const wasPaused = this.state.paused;

    this.thumbnailer.clear();
    await this.stop();
    await this.initialize();

    if (!currentSource) {
      return;
    }

    this.currentSource = currentSource;
    const shouldWaitForFileLoaded = currentTime > 0 || wasPaused;
    const fileLoaded = shouldWaitForFileLoaded ? this.waitForEvent("file-loaded") : null;
    await this.loadFile(currentSource, false);
    if (fileLoaded) {
      await fileLoaded;
    }

    if (currentTime > 0) {
      await this.seekAbsolute(currentTime).catch(() => undefined);
    }

    if (wasPaused) {
      await this.pause().catch(() => undefined);
    }

    this.thumbnailer.setSource(isLikelyAudioSource(currentSource) ? null : currentSource);
  }
}
