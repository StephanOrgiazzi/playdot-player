import { listenEvents } from "./libmpv-api";

export async function waitForMpvEvent(eventName: string, timeoutMs = 5000): Promise<boolean> {
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
