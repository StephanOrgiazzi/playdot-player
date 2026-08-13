import { expect, test } from "bun:test";
import { LatestValueWriter } from "../src/shared/lib/LatestValueWriter";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error | null) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("coalesces pending writes while preserving the active write", async () => {
  const firstStarted = deferred<void>();
  const releaseFirst = deferred<void>();
  const written: number[] = [];
  const writer = new LatestValueWriter<number>(async (value) => {
    written.push(value);
    if (value === 1) {
      firstStarted.resolve();
      await releaseFirst.promise;
    }
  });

  const first = writer.write(1);
  await firstStarted.promise;
  expect(writer.isIdle()).toBe(false);
  const second = writer.write(2);
  const third = writer.write(3);
  releaseFirst.resolve();

  await Promise.all([first, second, third, writer.whenIdle()]);
  expect(written).toEqual([1, 3]);
  expect(writer.isIdle()).toBe(true);
});

test("continues with the newest pending write after a failure", async () => {
  const firstStarted = deferred<void>();
  const releaseFirst = deferred<void>();
  const written: number[] = [];
  const writer = new LatestValueWriter<number>(async (value) => {
    written.push(value);
    if (value === 1) {
      firstStarted.resolve();
      await releaseFirst.promise;
      throw new Error("first write failed");
    }
  });

  const first = writer.write(1);
  await firstStarted.promise;
  const second = writer.write(2);
  releaseFirst.resolve();

  await expect(first).rejects.toThrow("first write failed");
  await second;
  await writer.whenIdle();
  expect(written).toEqual([1, 2]);
});

test("returns to idle when a writer throws synchronously", async () => {
  const writer = new LatestValueWriter<number>(() => {
    throw new Error("synchronous failure");
  });

  await expect(writer.write(1)).rejects.toThrow("synchronous failure");
  await writer.whenIdle();
  expect(writer.isIdle()).toBe(true);
});

test("supports revision checks for latest-request-wins work", async () => {
  type Request = { name: string; revision: number };
  const firstStarted = deferred<void>();
  const releaseFirst = deferred<void>();
  const applied: string[] = [];
  let currentRevision = 0;
  const writer = new LatestValueWriter<Request>(async (request) => {
    if (request.revision === 1) {
      firstStarted.resolve();
      await releaseFirst.promise;
    }
    if (request.revision === currentRevision) {
      applied.push(request.name);
    }
  });

  currentRevision = 1;
  const first = writer.write({ name: "first", revision: currentRevision });
  await firstStarted.promise;
  currentRevision = 2;
  const second = writer.write({ name: "second", revision: currentRevision });
  currentRevision = 3;
  const third = writer.write({ name: "third", revision: currentRevision });
  releaseFirst.resolve();

  await Promise.all([first, second, third, writer.whenIdle()]);
  expect(applied).toEqual(["third"]);
});
