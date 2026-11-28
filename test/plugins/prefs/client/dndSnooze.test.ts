import { describe, expect, test } from "bun:test";
import { flush } from "solid-js";
import { createFakeEnv } from "../../../support/core";
import { settle, startPrefs } from "./prefsHarness";

function start(endtime: () => number | null | "fail") {
  const env = createFakeEnv(1, 1_000_000);
  env.fetch.respond(
    () => true,
    () => {
      const next = endtime();
      const body = next === "fail" ? { error: "boom", ok: false } : { endtime: next, ok: true };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status: next === "fail" ? 500 : 200,
      });
    },
  );
  return startPrefs(env);
}

describe("dnd snooze", () => {
  test("follows the server status and a later refresh replaces a local change", async () => {
    let endtime: number | null | "fail" = 2_000;
    const { store } = await start(() => endtime);
    expect(store.dndSnoozedUntil()).toBe(2_000_000);

    store.applyDndSnoozeEvent(null);
    flush();
    expect(store.dndSnoozedUntil()).toBeNull();

    endtime = 3_000;
    await store.retryDndStatus();
    await settle();
    expect(store.dndSnoozedUntil()).toBe(3_000_000);
  });

  test("a failed status refresh keeps the last known snooze", async () => {
    let endtime: number | null | "fail" = 2_000;
    const { env, store } = await start(() => endtime);
    endtime = "fail";
    const retry = store.retryDndStatus();
    for (let attempt = 0; attempt < 10; attempt++) {
      await settle();
      env.advance(60_000);
    }
    await retry;
    expect(store.dndSnoozedUntil()).toBe(2_000_000);
  });

  test("the snooze ends when its time passes", async () => {
    const { env, store } = await start(() => 1_060);
    expect(store.isDndActive()).toBe(true);
    env.advance(61_000);
    await settle();
    expect(store.dndSnoozedUntil()).toBeNull();
    expect(store.isDndActive()).toBe(false);
  });
});
