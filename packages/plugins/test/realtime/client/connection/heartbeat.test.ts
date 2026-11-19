import { describe, expect, test } from "bun:test";
import { createFakeEnv } from "@slock/core/testing";
import { createHeartbeat } from "../../../../src/realtime/client/connection/heartbeat";

function monitored() {
  const env = createFakeEnv();
  const log: string[] = [];
  const heartbeat = createHeartbeat({
    env,
    onDead: () => void log.push("dead"),
    ping: () => void log.push("ping"),
  });
  return { env, heartbeat, log };
}

describe("heartbeat", () => {
  test("pings every 20 seconds while replies keep coming", () => {
    const { env, heartbeat, log } = monitored();
    heartbeat.start();
    for (let tick = 0; tick < 5; tick++) {
      env.advance(20_000);
      heartbeat.heard();
    }
    expect(log).toEqual(["ping", "ping", "ping", "ping", "ping"]);
  });

  test("an unanswered ping is dead at the next tick and the timer stops", () => {
    const { env, heartbeat, log } = monitored();
    heartbeat.start();
    env.advance(39_999);
    expect(log).toEqual(["ping"]);
    env.advance(1);
    expect(log).toEqual(["ping", "dead"]);
    env.advance(600_000);
    expect(log).toEqual(["ping", "dead"]);
  });

  test("a reply that arrives late but before the next tick still counts", () => {
    const { env, heartbeat, log } = monitored();
    heartbeat.start();
    env.advance(20_000);
    env.advance(19_000);
    heartbeat.heard();
    env.advance(1000);
    expect(log).toEqual(["ping", "ping"]);
  });

  test("traffic before the first ping needs no ping to stay alive", () => {
    const { env, heartbeat, log } = monitored();
    heartbeat.start();
    heartbeat.heard();
    env.advance(20_000);
    expect(log).toEqual(["ping"]);
  });

  test("stop cancels the timer and forgets the pending ping", () => {
    const { env, heartbeat, log } = monitored();
    heartbeat.start();
    env.advance(20_000);
    heartbeat.stop();
    env.advance(600_000);
    expect(log).toEqual(["ping"]);
    heartbeat.start();
    env.advance(20_000);
    expect(log).toEqual(["ping", "ping"]);
  });

  test("starting twice keeps a single timer", () => {
    const { env, heartbeat, log } = monitored();
    heartbeat.start();
    heartbeat.start();
    env.advance(20_000);
    expect(log).toEqual(["ping"]);
  });
});
