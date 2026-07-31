// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createReconnectScheduler } from "./reconnectScheduler";

describe("createReconnectScheduler", () => {
  test("backs off, deduplicates timers, and resets after connection", () => {
    let callback: (() => void) | undefined;
    let connections = 0;
    const scheduler = createReconnectScheduler({
      clearTimer: () => {
        callback = undefined;
      },
      connect: () => connections++,
      isOnline: () => true,
      setTimer: (next) => {
        callback = next;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
    });

    expect(scheduler.schedule()).toBe(1000);
    expect(scheduler.schedule()).toBeUndefined();
    callback?.();
    expect(connections).toBe(1);
    expect(scheduler.schedule()).toBe(1700);
    scheduler.connected();
    expect(scheduler.schedule()).toBe(1000);
  });

  test("pauses while offline and cancels scheduled work on dispose", () => {
    let online = false;
    let callback: (() => void) | undefined;
    let connections = 0;
    const scheduler = createReconnectScheduler({
      clearTimer: () => {
        callback = undefined;
      },
      connect: () => connections++,
      isOnline: () => online,
      setTimer: (next) => {
        callback = next;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
    });

    expect(scheduler.schedule()).toBeUndefined();
    online = true;
    scheduler.schedule();
    scheduler.dispose();
    callback?.();
    scheduler.reconnectNow();
    expect(connections).toBe(0);
  });
});
