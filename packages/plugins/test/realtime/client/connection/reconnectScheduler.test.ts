import { describe, expect, test } from "bun:test";
import { createFakeEnv } from "@slock/core/testing";
import { createReconnectScheduler } from "../../../../src/realtime/client/connection/reconnectScheduler";

function scheduler(online = true) {
  const env = createFakeEnv();
  const state = { connects: 0, online };
  const reconnect = createReconnectScheduler({
    connect: () => void state.connects++,
    env,
    isOnline: () => state.online,
  });
  return { env, reconnect, state };
}

describe("reconnect scheduler", () => {
  test("waits grow with each failed attempt and stay under the cap", () => {
    const { env, reconnect } = scheduler();
    const waits: number[] = [];
    for (let i = 0; i < 12; i++) {
      const wait = reconnect.schedule();
      if (wait === undefined) throw new Error("expected a wait");
      waits.push(wait);
      env.advance(wait);
    }
    expect(waits[3]).toBeGreaterThan(waits[0] ?? 0);
    expect(Math.max(...waits)).toBeLessThanOrEqual(20_000 * 1.3);
  });

  test("connects once when the timer fires", () => {
    const { env, reconnect, state } = scheduler();
    const wait = reconnect.schedule() ?? 0;
    env.advance(wait - 1);
    expect(state.connects).toBe(0);
    env.advance(1);
    expect(state.connects).toBe(1);
  });

  test("a second schedule while one is pending is ignored", () => {
    const { env, reconnect, state } = scheduler();
    reconnect.schedule();
    expect(reconnect.schedule()).toBeUndefined();
    env.runAll();
    expect(state.connects).toBe(1);
  });

  test("connected resets the backoff", () => {
    const { env, reconnect } = scheduler();
    const first = reconnect.schedule() ?? 0;
    env.advance(first);
    for (let i = 0; i < 5; i++) env.advance(reconnect.schedule() ?? 0);
    reconnect.connected();
    const reset = reconnect.schedule() ?? 0;
    expect(reset).toBeLessThan(1000 * 1.3 + 1);
  });

  test("offline schedules nothing and a timer that fires offline does not connect", () => {
    const { env, reconnect, state } = scheduler();
    reconnect.schedule();
    state.online = false;
    env.runAll();
    expect(state.connects).toBe(0);
    expect(reconnect.schedule()).toBeUndefined();
    expect(env.pendingTimers()).toBe(0);
  });

  test("pause cancels the pending timer and allows scheduling again", () => {
    const { env, reconnect, state } = scheduler();
    reconnect.schedule();
    reconnect.pause();
    env.runAll();
    expect(state.connects).toBe(0);
    expect(reconnect.schedule()).not.toBeUndefined();
  });

  test("reconnectNow connects immediately and cancels the timer", () => {
    const { env, reconnect, state } = scheduler();
    reconnect.schedule();
    reconnect.reconnectNow();
    env.runAll();
    expect(state.connects).toBe(1);
  });

  test("dispose stops everything", () => {
    const { env, reconnect, state } = scheduler();
    reconnect.schedule();
    reconnect.dispose();
    reconnect.reconnectNow();
    expect(reconnect.schedule()).toBeUndefined();
    env.runAll();
    expect(state.connects).toBe(0);
  });
});
