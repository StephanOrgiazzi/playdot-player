import { invoke } from "@tauri-apps/api/core";
import { getProperty, setProperty } from "./libmpv-api";

export type AudioBridgeStatus = { enabled: boolean; error: string | null };
type DisplayMode = "duplicate" | "pcOnly";

export type AudioBridgeTransport = {
  start: () => Promise<string>;
  stop: () => Promise<void>;
  readDevice: () => Promise<string | null>;
  writeDevice: (device: string) => Promise<void>;
  setDisplayMode: (mode: DisplayMode) => Promise<void>;
};

function invokeBridge<T>(command: string, args?: { mode: DisplayMode }): Promise<T> {
  return invoke<T>(command, args).catch((cause: unknown) => {
    throw cause instanceof Error ? cause : new Error(String(cause));
  });
}

const transport: AudioBridgeTransport = {
  start: () => invokeBridge<string>("audio_bridge_start"),
  stop: () => invokeBridge<void>("audio_bridge_stop"),
  readDevice: () => getProperty("audio-device", "string"),
  writeDevice: (device) => setProperty("audio-device", device),
  setDisplayMode: (mode) => invokeBridge<void>("audio_bridge_set_display_mode", { mode }),
};

// Duplicate before opening HDMI audio. A failed activation and normal
// deactivation both return to PC-only and restore the previous mpv output.
export class AudioBridgeController {
  private previousDevice: string | null = null;
  private pending: Promise<void> = Promise.resolve();
  private active = false;

  constructor(private readonly host: AudioBridgeTransport = transport) {}

  get enabled(): boolean {
    return this.active;
  }

  enable(): Promise<void> {
    return this.enqueue(async () => {
      if (this.active) return;
      const previous = (await this.host.readDevice()) ?? "auto";
      await this.host.setDisplayMode("duplicate");
      try {
        const source = await this.host.start();
        await this.host.writeDevice(source);
      } catch (error) {
        try {
          await this.restore(previous);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `${String(error)}; cleanup failed: ${String(cleanupError)}`,
          );
        }
        throw error;
      }
      this.previousDevice = previous;
      this.active = true;
    });
  }

  disable(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      try {
        await this.restore(this.previousDevice ?? "auto");
      } finally {
        this.previousDevice = null;
        this.active = false;
      }
    });
  }

  private async restore(previous: string): Promise<void> {
    const errors: unknown[] = [];
    // Stop capture before disabling HDMI; restore audio after Windows changes
    // its active outputs. Every cleanup step must run even if another fails.
    for (const restore of [
      () => this.host.stop(),
      () => this.host.setDisplayMode("pcOnly"),
      () => this.host.writeDevice(previous),
    ]) {
      try {
        await restore();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, errors.map(String).join("; "));
    }
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.pending.then(task);
    this.pending = next.catch(() => undefined);
    return next;
  }
}

export function readAudioBridgeStatus(): Promise<AudioBridgeStatus> {
  return invokeBridge<AudioBridgeStatus>("audio_bridge_status");
}
