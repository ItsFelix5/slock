// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createDebouncedRequest } from "../../../../../ui/src/debouncedRequest";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

const startTimer = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createDebouncedRequest", () => {
  test("invalidates an in-flight result as soon as the query is cleared", async () => {
    const request = deferred<string[]>();
    const results: string[][] = [];
    const pending: boolean[] = [];
    const controller = createDebouncedRequest(() => request.promise, {
      delay: 0,
      onPendingChange: (value) => pending.push(value),
      onReset: () => results.splice(0),
      onResult: (result) => results.push(result),
    });

    controller.run("old query");
    await startTimer();
    controller.run("");
    request.resolve(["stale result"]);
    await request.promise;

    expect(results).toEqual([]);
    expect(pending.at(-1)).toBe(false);
    controller.dispose();
  });

  test("only applies the latest overlapping request", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const requests = [first, second];
    const results: string[] = [];
    const controller = createDebouncedRequest(() => requests.shift()?.promise ?? second.promise, {
      delay: 0,
      onResult: (result) => results.push(result),
    });

    controller.run("first");
    await startTimer();
    controller.run("second");
    await startTimer();
    first.resolve("stale");
    second.resolve("latest");
    await Promise.all([first.promise, second.promise]);

    expect(results).toEqual(["latest"]);
    controller.dispose();
  });

  test("reports current request failures without rejecting", async () => {
    const request = deferred<string>();
    const errors: unknown[] = [];
    const pending: boolean[] = [];
    const controller = createDebouncedRequest(() => request.promise, {
      delay: 0,
      onError: (error) => errors.push(error),
      onPendingChange: (value) => pending.push(value),
      onResult: () => {},
    });

    controller.run("broken");
    await startTimer();
    request.reject(new Error("network failed"));
    await request.promise.catch(() => {});
    await Promise.resolve();

    expect(errors).toHaveLength(1);
    expect(pending.at(-1)).toBe(false);
    controller.dispose();
  });
});
