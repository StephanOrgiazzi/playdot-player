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
import { OBSERVED_PROPERTIES, SUBTITLE_SCALE, clampMpvVolume } from "./constants";
import {
  AUDIO_NORMALIZER_FILTER,
  createMpvConfig,
  getMpvLoadOptionsForSource,
  getMpvResourcePaths,
  getStereoDownmixMpvOptions,
} from "./config";
import { waitForMpvEvent } from "./events";
import { toggleFsrShaders } from "./fsr";
import { MpvThumbnailer } from "./MpvThumbnailer";
import { applyObservedProperty } from "./stateUpdates";
import { getNextAudioTrackSelection, getNextSubtitleTrackSelection } from "./tracks";
import {
  DEFAULT_PLAYBACK_SPEED,
  EMPTY_PLAYER_STATE,
  type MediaTrack,
  type PlayerState,
} from "@features/player/model/playerState";
type PlayerListener = (state: PlayerState) => void;
const MIN_PLAYBACK_SPEED = 0.01;

export class MpvPlayer {
  private state: PlayerState = { ...EMPTY_PLAYER_STATE };
  private thumbnailer = new MpvThumbnailer();

  private listeners = new Set<PlayerListener>();
  private emitFrameId: number | null = null;
  private unlisten: (() => void) | null = null;
  private fsrToggle: Promise<boolean> | null = null;
  private upscaleShaderBundles: string[][] = [];
  private appliedUpscaleShaderPaths: string[] = [];
  private audioNormalizerEnabled = false;
  private stereoDownmixEnabled = false;
  private svpEnabled = false;
  private started = false;
  private currentSource: string | null = null;

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

  getSnapshot(): PlayerState {
    return this.state;
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
    await readAudioArtworkUrl(null).catch(() => "");
    this.state = { ...EMPTY_PLAYER_STATE };
    this.emitImmediately();

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

  async setAudioNormalizerEnabled(enabled: boolean): Promise<void> {
    if (this.audioNormalizerEnabled === enabled) {
      return;
    }

    const previous = this.audioNormalizerEnabled;
    this.audioNormalizerEnabled = enabled;

    if (!this.started) {
      return;
    }

    try {
      await setProperty("af", enabled ? AUDIO_NORMALIZER_FILTER : "");
    } catch (error) {
      this.audioNormalizerEnabled = previous;
      throw error;
    }
  }

  async loadFile(path: string): Promise<void> {
    this.currentSource = path;
    const isAudioSource = isLikelyAudioSource(path);
    const audioArtworkUrl = await readAudioArtworkUrl(isAudioSource ? path : null).catch(() => "");

    this.thumbnailer.setSource(isAudioSource ? null : path);
    this.prepareAudioArtworkLoad(audioArtworkUrl);
    if (audioArtworkUrl) {
      await setVideoMarginRatio(AUDIO_ARTWORK_HIDDEN_VIDEO_MARGIN_RATIO).catch(() => undefined);
      await nextAnimationFrame();
    } else {
      await setVideoMarginRatio({ left: 0, right: 0, top: 0, bottom: 0 }).catch(() => undefined);
    }

    await this.loadMpvFile(path);
  }

  async togglePlayPause(): Promise<void> {
    const confirmedPaused = await this.readPlayerFlag("pause");
    const playbackBlocked = this.state.pausedForCache || this.state.coreIdle;
    const nextPause = playbackBlocked ? false : !(confirmedPaused ?? this.state.paused);
    await this.setPlayerFlag("pause", nextPause);
  }

  private async play(): Promise<void> {
    await this.setPlayerFlag("pause", false);
  }

  private async pause(): Promise<void> {
    await this.setPlayerFlag("pause", true);
  }

  async seekAbsolute(seconds: number): Promise<void> {
    await command("seek", [Math.max(0, seconds), "absolute+exact"]);
  }

  async seekRelative(seconds: number): Promise<void> {
    await command("seek", [seconds, "relative"]);
  }

  private async initialize(): Promise<void> {
    if (this.started || this.unlisten) {
      await destroy().catch(() => undefined);
    }

    const resourcePaths = await getMpvResourcePaths();
    const config = await createMpvConfig(resourcePaths, {
      audioNormalizerEnabled: this.audioNormalizerEnabled,
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
      const nextState = applyObservedProperty(this.state, event);
      if (nextState === this.state) {
        return;
      }

      this.state = nextState;
      this.emit();
    });
  }

  private prepareAudioArtworkLoad(audioArtworkUrl: string): void {
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

  getVolume(): number {
    return this.state.volume;
  }

  getIsMuted(): boolean {
    return this.state.mute;
  }

  async adjustPlaybackSpeed(multiplier: number): Promise<number> {
    const currentSpeed = this.state.playbackSpeed || DEFAULT_PLAYBACK_SPEED;
    const nextSpeed = Math.max(MIN_PLAYBACK_SPEED, Number((currentSpeed * multiplier).toFixed(3)));

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
    await this.setTrackSelection("audio", id);
  }

  async setSubtitleTrack(id: number | "no"): Promise<void> {
    await this.setTrackSelection("sub", id);
  }

  async cycleAudioTrack(): Promise<void> {
    const nextTrackId = getNextAudioTrackSelection(this.state);
    if (nextTrackId !== null) {
      await this.setAudioTrack(nextTrackId);
    }
  }

  async cycleSubtitleTrack(): Promise<void> {
    const nextSelection = getNextSubtitleTrackSelection(this.state);
    if (nextSelection !== null) {
      await this.setSubtitleTrack(nextSelection);
    }
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

  private async runFsrToggle(): Promise<boolean> {
    const result = await toggleFsrShaders(
      this.appliedUpscaleShaderPaths,
      this.upscaleShaderBundles,
    );
    this.appliedUpscaleShaderPaths = result.appliedShaderPaths;
    return result.enabled;
  }

  private async applyStereoDownmixSettings(enabled: boolean): Promise<void> {
    await Promise.all(
      Object.entries(getStereoDownmixMpvOptions(enabled)).map(([name, value]) =>
        setProperty(name, value),
      ),
    );
  }

  private async setTrackSelection(
    type: Extract<MediaTrack["type"], "audio" | "sub">,
    selection: number | "no",
  ): Promise<void> {
    const stateKey = type === "audio" ? "selectedAudioTrackId" : "selectedSubtitleTrackId";
    const property = type === "audio" ? "aid" : "sid";
    const previousSelection = this.state[stateKey];
    const nextSelection = selection === "no" ? null : selection;

    if (previousSelection !== nextSelection) {
      this.state = { ...this.state, [stateKey]: nextSelection };
      this.emit();
    }

    try {
      await command("set", [property, String(selection)]);
    } catch (error) {
      if (this.state[stateKey] === nextSelection) {
        this.state = { ...this.state, [stateKey]: previousSelection };
        this.emit();
      }
      throw error;
    }
  }

  private async resetPerMediaDefaults(): Promise<void> {
    await Promise.all([setProperty("sub-scale", SUBTITLE_SCALE), setProperty("gamma", 1)]);
  }

  private async loadMpvFile(path: string): Promise<void> {
    const loadOptions = getMpvLoadOptionsForSource(path);
    await command("loadfile", loadOptions ? [path, "replace", -1, loadOptions] : [path]);
    await this.resetPerMediaDefaults();
    await this.play();
  }

  private async restartWithCurrentMedia(): Promise<void> {
    const currentSource = this.currentSource;
    const currentTime = this.state.timePos;
    const wasPaused = this.state.paused;

    this.thumbnailer.clear();
    this.clearPendingEmit();
    this.unlisten?.();
    this.unlisten = null;
    this.started = false;
    await destroy().catch(() => undefined);
    await this.initialize();

    if (!currentSource) {
      return;
    }

    this.currentSource = currentSource;
    const shouldWaitForFileLoaded = currentTime > 0 || wasPaused;
    const fileLoaded = shouldWaitForFileLoaded ? waitForMpvEvent("file-loaded") : null;
    await this.loadMpvFile(currentSource);
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
