import type { Env } from "../../../packages/core/src/types";

type Timer = { id: number; at: number; callback: () => void; every?: number };

const RUN_ALL_LIMIT = 10_000;

export function createFakeTimers(start: number) {
  const timers = new Map<number, Timer>();
  let now = start;
  let nextId = 0;

  function schedule(callback: () => void, ms: number, every?: number) {
    const timer: Timer = { at: now + Math.max(0, ms), callback, every, id: nextId++ };
    timers.set(timer.id, timer);
    return { cancel: () => void timers.delete(timer.id) };
  }

  function nextDue(limit: number): Timer | undefined {
    let found: Timer | undefined;
    for (const timer of timers.values()) {
      if (timer.at > limit) continue;
      if (!found || timer.at < found.at || (timer.at === found.at && timer.id < found.id))
        found = timer;
    }
    return found;
  }

  function fire(timer: Timer) {
    now = Math.max(now, timer.at);
    if (timer.every === undefined) timers.delete(timer.id);
    else timer.at = now + timer.every;
    timer.callback();
  }

  const api: Pick<Env, "now" | "setTimeout" | "clearTimeout" | "setInterval" | "clearInterval"> = {
    clearInterval: (handle) => handle?.cancel(),
    clearTimeout: (handle) => handle?.cancel(),
    now: () => now,
    setInterval: (callback, ms) => schedule(callback, ms, Math.max(1, ms)),
    setTimeout: (callback, ms) => schedule(callback, ms),
  };

  return {
    advance(ms: number) {
      const target = now + ms;
      for (let timer = nextDue(target); timer; timer = nextDue(target)) fire(timer);
      now = target;
    },
    sleep(ms: number) {
      now += ms;
      for (let timer = nextDue(now); timer; timer = nextDue(now)) fire(timer);
    },
    api,
    pending: () => timers.size,
    runAll() {
      for (let count = 0; timers.size > 0; count++) {
        if (count >= RUN_ALL_LIMIT)
          throw new Error("runAll did not settle, is an interval running?");
        const timer = nextDue(Number.POSITIVE_INFINITY);
        if (timer) fire(timer);
      }
    },
  };
}
