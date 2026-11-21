import { describe, expect, test } from "bun:test";
import { createResourceHub } from "../src/hub";
import { createFakeClock, manualLoader, settleMicrotasks } from "../src/testing";
import { harness } from "./harness";

const fail = async (call: { reject(error: unknown): void } | undefined, message = "boom") => {
  call?.reject(new Error(message));
  await settleMicrotasks();
};

describe("retry", () => {
  test("a transient failure is retried after a backoff and then succeeds", async () => {
    const { cache, calls, clock, flush } = harness({ random: () => 1 });
    const waiting = cache.ensure("a");
    await fail(calls[0]);
    expect(calls).toHaveLength(1);
    clock.advance(999);
    await flush();
    expect(calls).toHaveLength(1);
    clock.advance(1);
    await flush();
    expect(calls).toHaveLength(2);
    calls[1]?.resolve("ok");
    expect(await waiting).toBe("ok");
  });

  test("backoff doubles each attempt and is capped by maxMs", async () => {
    const { cache, calls, clock, flush } = harness({
      random: () => 1,
      retry: { baseMs: 100, maxMs: 300, retries: 5 },
    });
    void cache.ensure("a").catch(() => {});
    for (const wait of [100, 200, 300, 300]) {
      await fail(calls.at(-1));
      const before = calls.length;
      clock.advance(wait - 1);
      await flush();
      expect(calls).toHaveLength(before);
      clock.advance(1);
      await flush();
      expect(calls).toHaveLength(before + 1);
    }
  });

  test("the backoff is between half and all of the delay according to the injected random", async () => {
    for (const [random, expected] of [
      [0, 500],
      [0.5, 750],
      [1, 1_000],
    ] as const) {
      const { cache, calls, clock, flush } = harness({ random: () => random });
      void cache.ensure("a").catch(() => {});
      await fail(calls[0]);
      clock.advance(expected - 1);
      await flush();
      expect(calls).toHaveLength(1);
      clock.advance(1);
      await flush();
      expect(calls).toHaveLength(2);
    }
  });

  test("the entry errors once retries are used up", async () => {
    const { cache, calls, clock, flush } = harness({ random: () => 0, retry: { retries: 2 } });
    const result = cache.ensure("a").catch((error: unknown) => error);
    for (let attempt = 0; attempt < 3; attempt++) {
      await fail(calls[attempt]);
      clock.advance(60_000);
      await flush();
    }
    expect(calls).toHaveLength(3);
    expect(await result).toEqual(new Error("boom"));
    expect(cache.state("a")).toMatchObject({ failures: 1, refreshing: false, status: "error" });
  });

  test("classify stop fails at once", async () => {
    const { cache, calls } = harness({ retry: { classify: () => "stop" } });
    const result = cache.ensure("a").catch((error: unknown) => error);
    await fail(calls[0], "channel_not_found");
    expect(await result).toEqual(new Error("channel_not_found"));
    expect(calls).toHaveLength(1);
  });

  test("a superseded fetch stops retrying", async () => {
    const { cache, calls, clock, flush } = harness({ random: () => 1 });
    void cache.ensure("a");
    await fail(calls[0]);
    cache.set("a", "manual");
    clock.advance(60_000);
    await flush();
    expect(calls).toHaveLength(1);
    expect(clock.pendingTimers()).toBe(1);
  });
});

describe("rate limit cooldown", () => {
  const rateLimited = { retry: { classify: () => ({ retryAfterMs: 5_000 }) } } as const;

  test("a rate limit pauses every cache in the hub, not only the failing entry", async () => {
    const clock = createFakeClock({ random: () => 0 });
    const hub = createResourceHub(clock);
    const first = manualLoader<string, string>();
    const second = manualLoader<string, string>();
    const a = hub.cache({ load: first.load, ...rateLimited });
    const b = hub.cache({ load: second.load });
    void a.ensure("x");
    await fail(first.calls[0], "ratelimited");
    const other = b.ensure("y");
    await settleMicrotasks();
    expect(second.calls).toHaveLength(0);
    clock.advance(4_999);
    await settleMicrotasks();
    expect(second.calls).toHaveLength(0);
    clock.advance(1);
    await settleMicrotasks();
    expect(second.calls).toHaveLength(1);
    expect(first.calls).toHaveLength(2);
    second.calls[0]?.resolve("done");
    expect(await other).toBe("done");
  });

  test("cooldown jitter is added from the injected random", () => {
    const clock = createFakeClock({ random: () => 1 });
    const hub = createResourceHub(clock, { jitterMs: 2_000 });
    hub.cooldown.pause(5_000);
    expect(hub.cooldown.active()).toBe(true);
    clock.advance(6_999);
    expect(hub.cooldown.active()).toBe(true);
    clock.advance(1);
    expect(hub.cooldown.active()).toBe(false);
  });

  test("a longer pause extends the cooldown and a shorter one does not shrink it", () => {
    const clock = createFakeClock({ random: () => 0 });
    const hub = createResourceHub(clock);
    hub.cooldown.pause(10_000);
    hub.cooldown.pause(1_000);
    clock.advance(9_999);
    expect(hub.cooldown.active()).toBe(true);
  });
});
