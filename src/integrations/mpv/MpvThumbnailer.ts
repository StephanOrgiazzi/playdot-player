import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { command, destroy, init, type MpvConfig } from "./libmpv-api";

const THUMBNAIL_INSTANCE_LABEL = "thumbnail-worker";
const EXACT_SEEK_DELAY_MS = 120;
const FRAME_POLL_INTERVAL_MS = 18;
const MAX_FRAME_POLLS = 20;
const PQ_TRANSFER_NAMES = ["pq", "st2084", "smpte2084"] as const;
const HLG_TRANSFER_NAMES = ["hlg", "arib-std-b67"] as const;

type ThumbnailTarget = {
  rawPath: string;
  imagePath: string;
  width: number;
  height: number;
};

type PendingSeek = {
  seconds: number;
  exact: boolean;
};

type WorkerPreparation = "existing" | "started";

type ThumbnailListener = (url: string) => void;
type HdrTransferFunction = "smpte2084" | "arib-std-b67";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

function getHdrTransferFunction(transferFunction: string | null): HdrTransferFunction | null {
  const normalizedTransfer = transferFunction?.toLowerCase() ?? "";
  if (PQ_TRANSFER_NAMES.some((name) => normalizedTransfer.includes(name))) {
    return "smpte2084";
  }

  if (HLG_TRANSFER_NAMES.some((name) => normalizedTransfer.includes(name))) {
    return "arib-std-b67";
  }

  return null;
}

export class MpvThumbnailer {
  private source: string | null = null;
  private startedSource: string | null = null;
  private target: ThumbnailTarget | null = null;
  private listeners = new Set<ThumbnailListener>();
  private currentUrl = "";
  private active = false;
  private pendingSeek: PendingSeek | null = null;
  private rendering = false;
  private workerStarted = false;
  private hdrTransferFunction: HdrTransferFunction | null = null;
  private exactSeekTimer: number | null = null;
  private frameRevision = 0;
  private lifecycleToken = 0;
  private teardown: Promise<void> = Promise.resolve();

  subscribe(listener: ThumbnailListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUrl);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setSource(source: string | null): void {
    if (source === this.source) {
      return;
    }

    this.source = source;
    this.hdrTransferFunction = null;
    this.lifecycleToken += 1;
    this.clear();
    this.queueTeardown();
  }

  setTransferFunction(transferFunction: string | null): void {
    const hdrTransferFunction = getHdrTransferFunction(transferFunction);
    if (hdrTransferFunction === this.hdrTransferFunction) {
      return;
    }

    this.hdrTransferFunction = hdrTransferFunction;
    this.lifecycleToken += 1;
    this.clear();
    this.queueTeardown();
  }

  request(seconds: number): void {
    if (!this.source || !Number.isFinite(seconds)) {
      return;
    }

    this.active = true;
    this.pendingSeek = { seconds: Math.max(0, seconds), exact: false };
    this.scheduleExactSeek(seconds);
    void this.flush();
  }

  clear(): void {
    this.active = false;
    this.pendingSeek = null;
    this.clearExactSeekTimer();
    this.emit("");
  }

  async stop(): Promise<void> {
    this.source = null;
    this.lifecycleToken += 1;
    this.clear();
    this.queueTeardown();
    await this.teardown;
  }

  private emit(url: string): void {
    if (url === this.currentUrl) {
      return;
    }

    this.currentUrl = url;
    for (const listener of this.listeners) {
      listener(url);
    }
  }

  private scheduleExactSeek(seconds: number): void {
    this.clearExactSeekTimer();

    this.exactSeekTimer = globalThis.setTimeout(() => {
      this.exactSeekTimer = null;
      if (!this.active) {
        return;
      }

      this.pendingSeek = { seconds: Math.max(0, seconds), exact: true };
      void this.flush();
    }, EXACT_SEEK_DELAY_MS);
  }

  private clearExactSeekTimer(): void {
    if (this.exactSeekTimer === null) {
      return;
    }

    globalThis.clearTimeout(this.exactSeekTimer);
    this.exactSeekTimer = null;
  }

  private async flush(): Promise<void> {
    if (this.rendering) {
      return;
    }

    this.rendering = true;
    try {
      while (this.pendingSeek) {
        const pending = this.pendingSeek;
        this.pendingSeek = null;
        const token = this.lifecycleToken;
        const url = await this.renderFrame(pending, token);
        if (url && this.active && token === this.lifecycleToken) {
          this.emit(url);
        }
      }
    } finally {
      this.rendering = false;
      if (this.pendingSeek) {
        void this.flush();
      }
    }
  }

  private async renderFrame(pending: PendingSeek, token: number): Promise<string | null> {
    const preparation = await this.ensureStarted(token, pending);
    if (!preparation || !this.target) {
      return null;
    }

    const target = this.target;
    if (preparation === "existing") {
      await invoke("discard_thumbnail_frame", { rawPath: target.rawPath }).catch(() => undefined);
      await command(
        "seek",
        [pending.seconds, pending.exact ? "absolute+exact" : "absolute+keyframes"],
        undefined,
        THUMBNAIL_INSTANCE_LABEL,
      ).catch(() => undefined);
    }

    for (let attempt = 0; attempt < MAX_FRAME_POLLS; attempt += 1) {
      await delay(FRAME_POLL_INTERVAL_MS);
      if (!this.active || token !== this.lifecycleToken) {
        return null;
      }

      const ready = await invoke<boolean>("promote_thumbnail_frame", {
        rawPath: target.rawPath,
        imagePath: target.imagePath,
      }).catch(() => false);
      if (ready) {
        this.frameRevision += 1;
        return `${convertFileSrc(target.imagePath)}?frame=${this.frameRevision}`;
      }
    }

    return null;
  }

  private async ensureStarted(
    token: number,
    initialSeek: PendingSeek,
  ): Promise<WorkerPreparation | null> {
    const source = this.source;
    if (!source || token !== this.lifecycleToken) {
      return null;
    }
    if (this.startedSource === source && this.target) {
      return "existing";
    }

    await this.teardown;
    if (source !== this.source || token !== this.lifecycleToken) {
      return null;
    }

    const target = await invoke<ThumbnailTarget>("create_thumbnail_target");
    this.target = target;
    try {
      await init(this.createConfig(target, initialSeek), undefined, THUMBNAIL_INSTANCE_LABEL);
      this.workerStarted = true;
      await command("loadfile", [source], undefined, THUMBNAIL_INSTANCE_LABEL);
      if (source !== this.source || token !== this.lifecycleToken) {
        this.queueTeardown();
        return null;
      }
      this.startedSource = source;
      return "started";
    } catch {
      this.queueTeardown();
      return null;
    }
  }

  private createConfig(target: ThumbnailTarget, initialSeek: PendingSeek): MpvConfig {
    const resizeFilter = `scale=w=${target.width}:h=${target.height}:force_original_aspect_ratio=decrease,pad=w=${target.width}:h=${target.height}:x=(ow-iw)/2:y=(oh-ih)/2,format=bgra`;
    const colorFilter = this.hdrTransferFunction
      ? `setparams=colorspace=bt2020nc:color_primaries=bt2020:color_trc=${this.hdrTransferFunction},zscale=t=linear:npl=100,format=gbrpf32le,tonemap=tonemap=mobius:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=full,`
      : "";

    return {
      initialOptions: {
        idle: "yes",
        pause: "yes",
        "keep-open": "always",
        start: initialSeek.seconds,
        "hr-seek": initialSeek.exact ? "yes" : "no",
        audio: "no",
        sub: "no",
        hwdec: "no",
        "demuxer-readahead-secs": 0,
        "demuxer-max-bytes": "128KiB",
        "vd-lavc-skiploopfilter": "all",
        "vd-lavc-fast": "yes",
        "vd-lavc-threads": 2,
        "sws-scaler": "fast-bilinear",
        vf: `lavfi=[${colorFilter}${resizeFilter}]`,
        ovc: "rawvideo",
        of: "image2",
        ofopts: "update=1",
        o: target.rawPath,
      },
    };
  }

  private queueTeardown(): void {
    this.startedSource = null;
    this.teardown = this.teardown.then(() => this.destroyWorker()).catch(() => undefined);
  }

  private async destroyWorker(): Promise<void> {
    const target = this.target;
    this.target = null;
    this.startedSource = null;
    if (this.workerStarted) {
      this.workerStarted = false;
      await destroy(undefined, THUMBNAIL_INSTANCE_LABEL).catch(() => undefined);
    }
    if (target) {
      await invoke("remove_thumbnail_target", {
        rawPath: target.rawPath,
        imagePath: target.imagePath,
      }).catch(() => undefined);
    }
  }
}
