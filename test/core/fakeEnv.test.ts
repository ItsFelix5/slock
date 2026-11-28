import { describe, expect, test } from "bun:test";
import { createFakeEnv } from "../support/core";

describe("fake clock", () => {
  test("only moves when advanced", () => {
    const env = createFakeEnv();
    const start = env.now();
    expect(env.now()).toBe(start);
    env.advance(250);
    expect(env.now()).toBe(start + 250);
  });

  test("starts where asked", () => {
    expect(createFakeEnv(1, 5000).now()).toBe(5000);
  });
});

describe("fake timers", () => {
  test("fire in due order, not scheduling order", () => {
    const env = createFakeEnv();
    const fired: string[] = [];
    env.setTimeout(() => fired.push("late"), 300);
    env.setTimeout(() => fired.push("early"), 100);
    env.setTimeout(() => fired.push("middle"), 200);
    env.advance(1000);
    expect(fired).toEqual(["early", "middle", "late"]);
  });

  test("fire in scheduling order when due together", () => {
    const env = createFakeEnv();
    const fired: string[] = [];
    env.setTimeout(() => fired.push("a"), 50);
    env.setTimeout(() => fired.push("b"), 50);
    env.advance(50);
    expect(fired).toEqual(["a", "b"]);
  });

  test("do not fire before they are due", () => {
    const env = createFakeEnv();
    let fired = false;
    env.setTimeout(() => {
      fired = true;
    }, 100);
    env.advance(99);
    expect(fired).toBe(false);
    env.advance(1);
    expect(fired).toBe(true);
  });

  test("see the clock at their due time", () => {
    const env = createFakeEnv(1, 0);
    const seen: number[] = [];
    env.setTimeout(() => seen.push(env.now()), 120);
    env.setTimeout(() => seen.push(env.now()), 40);
    env.advance(500);
    expect(seen).toEqual([40, 120]);
    expect(env.now()).toBe(500);
  });

  test("fire timers scheduled by fired timers inside the window", () => {
    const env = createFakeEnv(1, 0);
    const seen: number[] = [];
    env.setTimeout(() => {
      seen.push(env.now());
      env.setTimeout(() => seen.push(env.now()), 100);
    }, 100);
    env.advance(250);
    expect(seen).toEqual([100, 200]);
  });

  test("leave timers scheduled beyond the window pending", () => {
    const env = createFakeEnv(1, 0);
    env.setTimeout(() => env.setTimeout(() => {}, 1000), 10);
    env.advance(100);
    expect(env.pendingTimers()).toBe(1);
  });

  test("can be cleared", () => {
    const env = createFakeEnv();
    let fired = 0;
    const handle = env.setTimeout(() => fired++, 10);
    env.clearTimeout(handle);
    env.clearTimeout(undefined);
    env.advance(100);
    expect(fired).toBe(0);
    expect(env.pendingTimers()).toBe(0);
  });

  test("can be cleared by an earlier timer", () => {
    const env = createFakeEnv();
    let fired = 0;
    const later = env.setTimeout(() => fired++, 20);
    env.setTimeout(() => env.clearTimeout(later), 10);
    env.advance(100);
    expect(fired).toBe(0);
  });

  test("run a zero delay timer on advance(0)", () => {
    const env = createFakeEnv();
    let fired = false;
    env.setTimeout(() => {
      fired = true;
    }, 0);
    env.advance(0);
    expect(fired).toBe(true);
  });
});

describe("fake intervals", () => {
  test("repeat every period", () => {
    const env = createFakeEnv(1, 0);
    const seen: number[] = [];
    env.setInterval(() => seen.push(env.now()), 100);
    env.advance(350);
    expect(seen).toEqual([100, 200, 300]);
  });

  test("stop when cleared from inside", () => {
    const env = createFakeEnv();
    let count = 0;
    const handle = env.setInterval(() => {
      if (++count === 2) env.clearInterval(handle);
    }, 10);
    env.advance(1000);
    expect(count).toBe(2);
    expect(env.pendingTimers()).toBe(0);
  });

  test("interleave with timeouts by due time", () => {
    const env = createFakeEnv(1, 0);
    const seen: string[] = [];
    env.setInterval(() => seen.push(`tick@${env.now()}`), 100);
    env.setTimeout(() => seen.push(`once@${env.now()}`), 150);
    env.advance(250);
    expect(seen).toEqual(["tick@100", "once@150", "tick@200"]);
  });
});

describe("runAll", () => {
  test("drains chained timers", () => {
    const env = createFakeEnv(1, 0);
    const seen: number[] = [];
    env.setTimeout(() => {
      seen.push(env.now());
      env.setTimeout(() => {
        seen.push(env.now());
        env.setTimeout(() => seen.push(env.now()), 5000);
      }, 1000);
    }, 10);
    env.runAll();
    expect(seen).toEqual([10, 1010, 6010]);
    expect(env.pendingTimers()).toBe(0);
  });

  test("refuses to spin on an endless interval", () => {
    const env = createFakeEnv();
    env.setInterval(() => {}, 10);
    expect(() => env.runAll()).toThrow("did not settle");
  });
});

describe("fake random", () => {
  test("repeats for the same seed and differs between seeds", () => {
    const a = createFakeEnv(5);
    const b = createFakeEnv(5);
    const c = createFakeEnv(6);
    const draw = (env: { random(): number }) => [env.random(), env.random(), env.random()];
    expect(draw(a)).toEqual(draw(b));
    expect(draw(createFakeEnv(5))).not.toEqual(draw(c));
  });
});

describe("fake storage", () => {
  test("stores, reads and removes strings", () => {
    const { storage } = createFakeEnv();
    expect(storage.get("k")).toBeNull();
    storage.set("k", "v");
    expect(storage.get("k")).toBe("v");
    storage.set("k", "w");
    expect(storage.get("k")).toBe("w");
    storage.remove("k");
    expect(storage.get("k")).toBeNull();
  });

  test("is not shared between envs", () => {
    const first = createFakeEnv();
    first.storage.set("k", "v");
    expect(createFakeEnv().storage.get("k")).toBeNull();
  });
});
