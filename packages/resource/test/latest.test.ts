import { describe, expect, test } from "bun:test";
import { deferred } from "../src/deferred";
import { createLatest } from "../src/latest";

describe("createLatest", () => {
  test("only the most recent begin is current", () => {
    const latest = createLatest();
    const first = latest.begin();
    const second = latest.begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  test("invalidate makes every outstanding ticket stale", () => {
    const latest = createLatest();
    const ticket = latest.begin();
    latest.invalidate();
    expect(ticket()).toBe(false);
  });

  test("run drops the result of a task that finished after a newer one started", async () => {
    const latest = createLatest();
    const slow = deferred<string>();
    const older = latest.run(() => slow.promise);
    const newer = await latest.run(() => Promise.resolve("new"));
    slow.resolve("old");
    expect(newer).toEqual({ current: true, value: "new" });
    expect(await older).toEqual({ current: false });
  });

  test("run throws failures of the current task and swallows stale ones", async () => {
    const latest = createLatest();
    const slow = deferred<string>();
    const stale = latest.run(() => slow.promise);
    const current = latest.run(() => Promise.reject(new Error("now")));
    await expect(current).rejects.toThrow("now");
    slow.reject(new Error("late"));
    expect(await stale).toEqual({ current: false });
  });
});
