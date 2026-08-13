import { command, destroy, getProperty, init, observeProperties, setProperty } from "./libmpv-api";
import { isLikelyAudioSource, readAudioArtworkUrl } from "./audioArtwork";
import { OBSERVED_PROPERTIES, SUBTITLE_SCALE, clampMpvVolume } from "./constants";
import {
  AUDIO_NORMALIZER_FILTER,
  createMpvConfig,
  getMpvLoadOptionsForSource,
  getMpvResourcePaths,
  getStereoDownmixMpvOptions,
} from "./config";
import { toggleFsrShaders } from "./fsr";
import { MpvThumbnailer } from "./MpvThumbnailer";
import { applyObservedProperty } from "./stateUpdates";
import { getNextAudioTrackSelection, getNextSubtitleTrackSelection } from "./tracks";
import { setVideoViewportHidden } from "./videoViewport";
import { syncSvpMpvFilter } from "@integrations/svp/mpv";
import { LatestValueWriter } from "@shared/lib/LatestValueWriter";
import {
  DEFAULT_PLAYBACK_SPEED,
  EMPTY_PLAYER_STATE,
  type MediaTrack,
  type PlayerState,
} from "@features/player/model/playerState";
type PlayerListener = (state: PlayerState) => void;
type LoadRequest = { path: string; revision: number };
type PropertyWrite = { revision: number; value: number; previousValue: number };
type VolumeWrite = PropertyWrite & { previousMute: boolean };
const MIN_PLAYBACK_SPEED = 0.01;

export class MpvPlayer {
  private state: PlayerState = { ...EMPTY_PLAYER_STATE };
  private readonly thumbnailer = new MpvThumbnailer();

  private readonly listeners = new Set<PlayerListener>();
  private emitFrameId: number | null = null;
  private unlisten: (() => void) | null = null;
  private fsrToggle: Promise<boolean> | null = null;
  private upscaleShaderBundles: string[][] = [];
  private appliedUpscaleShaderPaths: string[] = [];
  private audioNormalizerEnabled = false;
  private stereoDownmixEnabled = false;
  private svpAvailable = false;
  private svpEnabled = false;
  private svpFilterSync: Promise<void> | null = null;
  private svpFilterRevision = 0;
  private loadRevision = 0;
  private volumeRevision = 0;
  private playbackSpeedRevision = 0;
  private started = false;

  private readonly loadWriter = new LatestValueWriter<LoadRequest>((request) =>
    this.loadCurrentFile(request),
  );
  private readonly volumeWriter = new LatestValueWriter<VolumeWrite>((write) =>
    this.applyVolume(write),
  );
  private readonly playbackSpeedWriter = new LatestValueWriter<PropertyWrite>((write) =>
    this.applyPlaybackSpeed(write),
  );
  private readonly absoluteSeekWriter = new LatestValueWriter<number>((seconds) =>
    command("seek", [seconds, "absolute+exact"]),
  );

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
    return (): void => {
      this.listeners.delete(listener);
    };
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
    const pendingFsrToggle = this.fsrToggle;
    const pendingSvpSync = this.svpFilterSync;
    this.loadRevision += 1;

    await Promise.all([
      this.loadWriter.whenIdle(),
      this.volumeWriter.whenIdle(),
      this.playbackSpeedWriter.whenIdle(),
      this.absoluteSeekWriter.whenIdle(),
      pendingFsrToggle?.then(() => undefined).catch(() => undefined) ?? Promise.resolve(),
      pendingSvpSync?.catch(() => undefined) ?? Promise.resolve(),
    ]);

    this.clearPendingEmit();
    this.unlisten?.();
    this.unlisten = null;
    this.fsrToggle = null;
    this.svpFilterSync = null;
    this.upscaleShaderBundles = [];
    this.appliedUpscaleShaderPaths = [];
    this.started = false;
    await Promise.all([readAudioArtworkUrl(null).catch(() => ""), setVideoViewportHidden(false)]);
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

    this.svpEnabled = enabled;

    if (!this.started) {
      return;
    }

    await this.syncSvpFilterState();
  }

  setSvpAvailable(available: boolean): void {
    this.svpAvailable = available;
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

  loadFile(path: string): Promise<void> {
    const revision = ++this.loadRevision;
    return this.loadWriter.write({ path, revision });
  }

  private async loadCurrentFile({ path, revision }: LoadRequest): Promise<void> {
    if (!this.isCurrentLoad(revision)) {
      return;
    }

    const isAudioSource = isLikelyAudioSource(path);
    const audioArtworkUrl = await readAudioArtworkUrl(isAudioSource ? path : null).catch(() => "");
    if (!this.isCurrentLoad(revision)) {
      return;
    }

    this.thumbnailer.setSource(isAudioSource ? null : path);
    this.prepareAudioArtworkLoad(audioArtworkUrl);
    await setVideoViewportHidden(audioArtworkUrl.length > 0);
    if (!this.isCurrentLoad(revision)) {
      return;
    }

    await this.loadMpvFile(path, revision);
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

  async seekAbsolute(seconds: number): Promise<void> {
    await this.absoluteSeekWriter.write(Math.max(0, seconds));
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
      svpAvailable: this.svpAvailable,
    });
    await init(config);
    this.upscaleShaderBundles = resourcePaths.upscaleShaderBundles;
    this.appliedUpscaleShaderPaths = [];
    this.started = true;

    this.state = { ...this.state, initialized: true };
    this.emit();

    this.unlisten = await observeProperties(OBSERVED_PROPERTIES, (event) => {
      if (event.name === "vf") {
        void this.syncSvpFilterState().catch(() => undefined);
        return;
      }
      if (
        ((event.name === "volume" || event.name === "mute") && !this.volumeWriter.isIdle()) ||
        (event.name === "speed" && !this.playbackSpeedWriter.isIdle())
      ) {
        return;
      }

      const nextState = applyObservedProperty(this.state, event);
      if (nextState === this.state) {
        return;
      }

      this.state = nextState;
      this.emit();
    });
  }

  private async syncSvpFilterState(): Promise<void> {
    if (!this.svpAvailable || !this.started) {
      return;
    }

    this.svpFilterRevision += 1;
    if (this.svpFilterSync) {
      return this.svpFilterSync;
    }

    const task = this.runSvpFilterSync().finally(() => {
      if (this.svpFilterSync === task) {
        this.svpFilterSync = null;
      }
    });
    this.svpFilterSync = task;
    return task;
  }

  private async runSvpFilterSync(): Promise<void> {
    let synchronizedRevision = 0;
    while (this.started && synchronizedRevision !== this.svpFilterRevision) {
      synchronizedRevision = this.svpFilterRevision;
      await syncSvpMpvFilter(this.svpEnabled);
    }
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

  setVolume(volume: number): Promise<void> {
    const previousVolume = this.state.volume;
    const previousMute = this.state.mute;
    const nextVolume = clampMpvVolume(volume);
    const nextMute = nextVolume > 0 ? false : this.state.mute;

    if (nextVolume !== this.state.volume || nextMute !== this.state.mute) {
      this.state = {
        ...this.state,
        volume: nextVolume,
        mute: nextMute,
      };
      this.emit();
    }

    const revision = ++this.volumeRevision;
    return this.volumeWriter.write({
      revision,
      value: nextVolume,
      previousValue: previousVolume,
      previousMute,
    });
  }

  private async applyVolume({
    revision,
    value,
    previousValue,
    previousMute,
  }: VolumeWrite): Promise<void> {
    try {
      if (value > 0) {
        await setProperty("mute", false);
      }
      await setProperty("volume", value);
      if (
        revision === this.volumeRevision &&
        (this.state.volume !== value || (value > 0 && this.state.mute))
      ) {
        const nextState = { ...this.state, volume: value };
        if (value > 0) nextState.mute = false;
        this.state = nextState;
        this.emit();
      }
    } catch (error) {
      if (revision === this.volumeRevision) {
        const [volume, mute] = await Promise.all([
          getProperty("volume", "double").catch(() => null),
          this.readPlayerFlag("mute"),
        ]);
        this.state = {
          ...this.state,
          volume: volume ?? previousValue,
          mute: mute ?? previousMute,
        };
        this.emit();
      }
      throw error;
    }
  }

  async toggleMute(): Promise<void> {
    await this.setPlayerFlag("mute", !this.state.mute);
  }

  async adjustPlaybackSpeed(multiplier: number): Promise<number> {
    const currentSpeed = this.state.playbackSpeed || DEFAULT_PLAYBACK_SPEED;
    const nextSpeed = Math.max(MIN_PLAYBACK_SPEED, Number((currentSpeed * multiplier).toFixed(3)));

    if (nextSpeed !== this.state.playbackSpeed) {
      this.state = { ...this.state, playbackSpeed: nextSpeed };
      this.emit();
    }

    const revision = ++this.playbackSpeedRevision;
    await this.playbackSpeedWriter.write({
      revision,
      value: nextSpeed,
      previousValue: currentSpeed,
    });
    return nextSpeed;
  }

  private async applyPlaybackSpeed({
    revision,
    value,
    previousValue,
  }: PropertyWrite): Promise<void> {
    try {
      await setProperty("speed", value);
      if (revision === this.playbackSpeedRevision && this.state.playbackSpeed !== value) {
        this.state = { ...this.state, playbackSpeed: value };
        this.emit();
      }
    } catch (error) {
      if (revision === this.playbackSpeedRevision) {
        const confirmedSpeed = await getProperty("speed", "double").catch(() => null);
        const reconciledSpeed = confirmedSpeed ?? previousValue;
        if (reconciledSpeed !== this.state.playbackSpeed) {
          this.state = { ...this.state, playbackSpeed: reconciledSpeed };
          this.emit();
        }
      }
      throw error;
    }
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
    const nextOptions = Object.entries(getStereoDownmixMpvOptions(enabled));
    const previousOptions = getStereoDownmixMpvOptions(!enabled);
    const applied: string[] = [];

    try {
      for (const [name, value] of nextOptions) {
        await setProperty(name, value);
        applied.push(name);
      }
    } catch (error) {
      await Promise.allSettled(
        applied.reverse().map((name) => setProperty(name, previousOptions[name] ?? "")),
      );
      throw error;
    }
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

  private isCurrentLoad(revision: number): boolean {
    return revision === this.loadRevision;
  }

  private async loadMpvFile(path: string, revision: number): Promise<void> {
    const loadOptions = getMpvLoadOptionsForSource(path);
    await command("loadfile", loadOptions ? [path, "replace", -1, loadOptions] : [path]);
    if (!this.isCurrentLoad(revision)) {
      return;
    }
    await this.resetPerMediaDefaults();
    if (!this.isCurrentLoad(revision)) {
      return;
    }
    await this.play();
  }
}
