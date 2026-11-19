import { describe, expect, test } from "bun:test";
import { createHost, localEnabledStore, systemEnv } from "../src";
import { createFakeEnv } from "../src/testing";
import type { Env, Setup } from "../src/types";

describe("host env", () => {
  test("hands plugins the env given to the host", async () => {
    const env = createFakeEnv();
    let seen: Env | undefined;
    const setup: Setup = (ctx) => {
      seen = ctx.get("env");
    };
    const host = createHost({ env });
    await host.register({ id: "a", setup });
    expect(seen).toBe(env);
    expect(host.service("env")).toBe(env);
  });

  test("defaults to the system env", () => {
    expect(createHost().service("env")).toBe(systemEnv);
  });

  test("keeps hosts apart", () => {
    const first = createFakeEnv();
    const second = createFakeEnv();
    expect(createHost({ env: first }).service("env")).toBe(first);
    expect(createHost({ env: second }).service("env")).toBe(second);
  });

  test("keeps the env across a restart", async () => {
    const env = createFakeEnv();
    const host = createHost({ env });
    await host.register({ id: "a", setup: () => {} });
    await host.restart();
    expect(host.service("env")).toBe(env);
  });
});

describe("enabled store on an env", () => {
  test("reads and writes through the given storage", () => {
    const { storage } = createFakeEnv();
    localEnabledStore("enabled", storage).write({ a: false });
    expect(storage.get("enabled")).toBe('{"a":false}');
    expect(localEnabledStore("enabled", storage).read()).toEqual({ a: false });
  });
});

describe("systemEnv", () => {
  test("reads the real clock and random", () => {
    const before = Date.now();
    expect(systemEnv.now()).toBeGreaterThanOrEqual(before);
    const value = systemEnv.random();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  test("runs and cancels real timers", async () => {
    let fired = 0;
    systemEnv.clearTimeout(systemEnv.setTimeout(() => fired++, 1));
    const kept = new Promise<void>((resolve) => {
      systemEnv.setTimeout(resolve, 1);
    });
    await kept;
    expect(fired).toBe(0);
    let ticks = 0;
    const interval = systemEnv.setInterval(() => ticks++, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    systemEnv.clearInterval(interval);
    const seen = ticks;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toBeGreaterThan(0);
    expect(ticks).toBe(seen);
  });
});
