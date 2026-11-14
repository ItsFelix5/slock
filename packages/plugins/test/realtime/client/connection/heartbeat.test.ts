import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { createHeartbeat } from "../../../../src/realtime/client/connection/heartbeat";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function monitored() {
  const log: string[] = [];
  const heartbeat = createHeartbeat({
    onDead: () => void log.push("dead"),
    ping: () => void log.push("ping"),
  });
  return { heartbeat, log };
}

describe("heartbeat", () => {
  test("pings every 20 seconds while replies keep coming", () => {
    const { heartbeat, log } = monitored();
    heartbeat.start();
    for (let tick = 0; tick < 5; tick++) {
      jest.advanceTimersByTime(20_000);
      heartbeat.heard();
    }
    expect(log).toEqual(["ping", "ping", "ping", "ping", "ping"]);
  });

  test("an unanswered ping is dead at the next tick and the timer stops", () => {
    const { heartbeat, log } = monitored();
    heartbeat.start();
    jest.advanceTimersByTime(39_999);
    expect(log).toEqual(["ping"]);
    jest.advanceTimersByTime(1);
    expect(log).toEqual(["ping", "dead"]);
    jest.advanceTimersByTime(600_000);
    expect(log).toEqual(["ping", "dead"]);
  });

  test("a reply that arrives late but before the next tick still counts", () => {
    const { heartbeat, log } = monitored();
    heartbeat.start();
    jest.advanceTimersByTime(20_000);
    jest.advanceTimersByTime(19_000);
    heartbeat.heard();
    jest.advanceTimersByTime(1000);
    expect(log).toEqual(["ping", "ping"]);
  });

  test("traffic before the first ping needs no ping to stay alive", () => {
    const { heartbeat, log } = monitored();
    heartbeat.start();
    heartbeat.heard();
    jest.advanceTimersByTime(20_000);
    expect(log).toEqual(["ping"]);
  });

  test("stop cancels the timer and forgets the pending ping", () => {
    const { heartbeat, log } = monitored();
    heartbeat.start();
    jest.advanceTimersByTime(20_000);
    heartbeat.stop();
    jest.advanceTimersByTime(600_000);
    expect(log).toEqual(["ping"]);
    heartbeat.start();
    jest.advanceTimersByTime(20_000);
    expect(log).toEqual(["ping", "ping"]);
  });

  test("starting twice keeps a single timer", () => {
    const { heartbeat, log } = monitored();
    heartbeat.start();
    heartbeat.start();
    jest.advanceTimersByTime(20_000);
    expect(log).toEqual(["ping"]);
  });
});
