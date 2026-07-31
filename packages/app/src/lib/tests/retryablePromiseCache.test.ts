// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { getOrCreateRetryablePromise } from "../../../../slack-api/src/api/cache/retryablePromiseCache";

describe("getOrCreateRetryablePromise", () => {
  test("deduplicates concurrent successful loads", async () => {
    const cache = new Map<string, Promise<string>>();
    let calls = 0;
    const load = () => {
      calls++;
      return Promise.resolve("ready");
    };

    const first = getOrCreateRetryablePromise(cache, "app", load);
    const second = getOrCreateRetryablePromise(cache, "app", load);

    expect(first).toBe(second);
    expect(await second).toBe("ready");
    expect(calls).toBe(1);
  });

  test("evicts a rejected load so the next attempt can recover", async () => {
    const cache = new Map<string, Promise<string>>();
    let calls = 0;
    const load = () => {
      calls++;
      if (calls === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve("recovered");
    };

    await expect(getOrCreateRetryablePromise(cache, "app", load)).rejects.toThrow("offline");
    expect(await getOrCreateRetryablePromise(cache, "app", load)).toBe("recovered");
    expect(calls).toBe(2);
  });
});
