type Waiter = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type PendingValue<T> = {
  value: T;
  waiters: Waiter[];
};

export class LatestValueWriter<T> {
  private pending: PendingValue<T> | null = null;
  private running = false;
  private worker: Promise<void> | null = null;

  constructor(private readonly writeValue: (value: T) => Promise<void>) {}

  write(value: T): Promise<void> {
    const completion = new Promise<void>((resolve, reject) => {
      if (this.pending) {
        this.pending.value = value;
        this.pending.waiters.push({ resolve, reject });
      } else {
        this.pending = { value, waiters: [{ resolve, reject }] };
      }
    });

    if (!this.running) {
      this.running = true;
      this.worker = Promise.resolve().then(() => this.drain());
    }

    return completion;
  }

  whenIdle(): Promise<void> {
    return this.worker ?? Promise.resolve();
  }

  isIdle(): boolean {
    return !this.running;
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const pending = this.pending;
      this.pending = null;

      try {
        await this.writeValue(pending.value);
        for (const waiter of pending.waiters) {
          waiter.resolve();
        }
      } catch (error) {
        for (const waiter of pending.waiters) {
          waiter.reject(error);
        }
      }
    }

    this.running = false;
    this.worker = null;
  }
}
