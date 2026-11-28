import { describe, expect, test } from "bun:test";
import { createCooldown } from "../../packages/resource/src/cooldown";
import { createResourceHub } from "../../packages/resource/src/hub";
import { createFakeClock, manualLoader, settleMicrotasks } from "../support/resource";
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
      if (attempt === 2) break;
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

  test("a rate limit pauses every key of its cache and leaves other caches alone", async () => {
    const clock = createFakeClock({ random: () => 0 });
    const hub = createResourceHub(clock);
    const first = manualLoader<string, string>();
    const second = manualLoader<string, string>();
    const a = hub.cache({ load: first.load, ...rateLimited });
    const b = hub.cache({ load: second.load });
    void a.ensure("x");
    await fail(first.calls[0], "ratelimited");
    void a.ensure("z");
    void b.ensure("y");
    await settleMicrotasks();
    expect(second.calls).toHaveLength(1);
    expect(first.calls).toHaveLength(1);
    clock.advance(5_000);
    await settleMicrotasks();
    expect(first.calls).toHaveLength(3);
  });

  test("cooldown jitter is added from the injected random", () => {
    const clock = createFakeClock({ random: () => 1 });
    const cooldown = createCooldown(clock, { jitterMs: 2_000 });
    cooldown.pause(5_000);
    expect(cooldown.active()).toBe(true);
    clock.advance(6_999);
    expect(cooldown.active()).toBe(true);
    clock.advance(1);
    expect(cooldown.active()).toBe(false);
  });

  test("a longer pause extends the cooldown and a shorter one does not shrink it", () => {
    const clock = createFakeClock({ random: () => 0 });
    const cooldown = createCooldown(clock);
    cooldown.pause(10_000);
    cooldown.pause(1_000);
    clock.advance(9_999);
    expect(cooldown.active()).toBe(true);
  });
});

describe("permanent failures", () => {
  test("a stopped failure is not refetched by a new subscriber", async () => {
    const { cache, calls, flush } = harness({ retry: { classify: () => "stop" } });
    const stop = cache.subscribe("a", () => {});
    await fail(calls[0], "enterprise_is_restricted");
    stop();
    cache.subscribe("a", () => {});
    await flush();
    expect(calls).toHaveLength(1);
  });

  test("a failure that only ran out of retries is refetched by a new subscriber", async () => {
    const { cache, calls, flush } = harness({ retry: { retries: 0 } });
    cache.subscribe("a", () => {})();
    await fail(calls[0]);
    cache.subscribe("a", () => {});
    await flush();
    expect(calls).toHaveLength(2);
  });

  test("invalidate and refresh still refetch a stopped failure", async () => {
    const { cache, calls, flush } = harness({ retry: { classify: () => "stop" } });
    const stop = cache.subscribe("a", () => {});
    await fail(calls[0]);
    cache.invalidate("a");
    await flush();
    expect(calls).toHaveLength(2);
    await fail(calls[1]);
    void cache.refresh("a").catch(() => {});
    expect(calls).toHaveLength(3);
    stop();
  });
});

describe("failed entries recover", () => {
  const once = { gcMs: Number.POSITIVE_INFINITY, retry: { retries: 0 } } as const;

  test("a failed entry someone is watching is tried again, later each time", async () => {
    const { cache, calls, clock, flush } = harness(once);
    cache.subscribe("a", () => {});
    await fail(calls[0]);
    clock.advance(30_000);
    await flush();
    expect(calls).toHaveLength(2);
    await fail(calls[1]);
    clock.advance(30_000);
    await flush();
    expect(calls).toHaveLength(2);
    clock.advance(30_000);
    await flush();
    expect(calls).toHaveLength(3);
  });

  test("an unwatched failure is forgotten even when data is kept forever", async () => {
    const { cache, calls, clock } = harness(once);
    void cache.ensure("a").catch(() => {});
    await fail(calls[0]);
    clock.advance(30_000);
    expect(cache.state("a").status).toBe("idle");
  });

  test("a permanent failure is not tried again", async () => {
    const { cache, calls, clock, flush } = harness({ retry: { classify: () => "stop" } });
    cache.subscribe("a", () => {});
    await fail(calls[0]);
    clock.advance(600_000);
    await flush();
    expect(calls).toHaveLength(1);
  });
});

describe("request", () => {
  test("retries under the same policy as a fetch", async () => {
    const { cache, clock, flush } = harness();
    let attempts = 0;
    const result = cache.request(() =>
      ++attempts === 1 ? Promise.reject(new Error("down")) : Promise.resolve("page"),
    );
    await flush();
    clock.advance(60_000);
    expect(await result).toBe("page");
    expect(attempts).toBe(2);
  });

  test("clearing the cache aborts it and resolves with nothing", async () => {
    const { cache, load, calls, flush } = harness();
    const result = cache.request((context) => load("page", context));
    await flush();
    cache.clear();
    expect(calls[0]?.signal.aborted).toBe(true);
    calls[0]?.resolve("late");
    expect(await result).toBeUndefined();
  });
});
