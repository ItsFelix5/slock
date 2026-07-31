// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createSerialMutationQueue } from "./serialMutationQueue";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("createSerialMutationQueue", () => {
  test("runs rapid edits in user intent order", async () => {
    const run = createSerialMutationQueue();
    const firstRequest = deferred<string>();
    const calls: string[] = [];

    const first = run(() => {
      calls.push("first");
      return firstRequest.promise;
    });
    const second = run(() => {
      calls.push("second");
      return Promise.resolve("second saved");
    });
    await Promise.resolve();
    expect(calls).toEqual(["first"]);

    firstRequest.resolve("first saved");
    expect(await first).toBe("first saved");
    expect(await second).toBe("second saved");
    expect(calls).toEqual(["first", "second"]);
  });

  test("continues after a failed edit", async () => {
    const run = createSerialMutationQueue();
    const firstRequest = deferred<void>();
    const first = run(() => firstRequest.promise);
    const second = run(() => Promise.resolve("saved"));

    firstRequest.reject(new Error("offline"));
    await expect(first).rejects.toThrow("offline");
    expect(await second).toBe("saved");
  });
});
