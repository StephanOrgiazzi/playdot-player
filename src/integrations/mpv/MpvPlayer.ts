import {
  command,
  destroy,
  getProperty,
  init,
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
import { createMpvConfig, getMpvLoadOptionsForSource, getMpvResourcePaths } from "./config";
import { waitForMpvEvent } from "./events";
import { toggleFsrShaders } from "./fsr";
import { MpvThumbnailer } from "./MpvThumbnailer";
import { getNextPauseForTransportToggle } from "./playbackControl";
import { applyObservedProperty } from "./stateUpdates";
import {
  getNextAudioTrackSelection,
  getNextSubtitleTrackSelection,
  matchesTrackSelection,
  type TrackSelection,
} from "./tracks";
import {
  EMPTY_PLAYER_STATE,
  type MediaTrack,
  type PlayerState,
} from "@features/player/model/playerState";
type PlayerListener = (state: PlayerState) => void;

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

  private async readPlayerFlag(name: "pause" | "mute"): Promise<boolean | null> {
    return getProperty(name, "flag").catch(() => null);
  }

  private async setPlayerFlag(name: "pause" | "mute", value: boolean): Promise<void> {
    await setProperty(name, value);

    const confirmedValue = await this.readPlayerFlag(name);
    const stateKey = name === "pause" ? "paused" : "mute";
    const nextValue = confirmedValue ?? value;
    if (this.state[stateKey] === nextValue) {
      return;
    }

    this.state = { ...this.state, [stateKey]: nextValue };
    this.emit();
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

    const loadOptions = getMpvLoadOptionsForSource(path);
    await command("loadfile", loadOptions ? [path, "replace", -1, loadOptions] : [path]);
    await this.resetPerMediaDefaults();

    await this.play();
  }

  async togglePlayPause(): Promise<void> {
    const confirmedPaused = await this.readPlayerFlag("pause");
    const nextPause = getNextPauseForTransportToggle(this.state, confirmedPaused);
    await this.setPlayerFlag("pause", nextPause);
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
    const nextTrackId = getNextAudioTrackSelection(this.state);
    if (nextTrackId === null) {
      return;
    }

    await this.setAudioTrack(nextTrackId);
    await this.waitForTrackSelection("audio", nextTrackId);
  }

  private async runSubtitleTrackCycle(): Promise<void> {
    const nextSelection = getNextSubtitleTrackSelection(this.state);
    if (nextSelection === null) {
      return;
    }

    await this.setSubtitleTrack(nextSelection);
    await this.waitForTrackSelection("sub", nextSelection);
  }

  private async runFsrToggle(): Promise<boolean> {
    const result = await toggleFsrShaders(
      this.appliedUpscaleShaderPaths,
      this.upscaleShaderBundles,
    );
    this.appliedUpscaleShaderPaths = result.appliedShaderPaths;
    return result.enabled;
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
    return matchesTrackSelection(this.state, type, target);
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
    const fileLoaded = shouldWaitForFileLoaded ? waitForMpvEvent("file-loaded") : null;
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
