import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type { GatewayEvent } from "../../../src/realtime/server/api";
import { createGateway } from "../../../src/realtime/server/gateway";
import { createGatewayHarness, creds, watch } from "../../../src/realtime/testing/gatewayHarness";

let h: ReturnType<typeof createGatewayHarness>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  h = createGatewayHarness();
});

afterEach(() => {
  h.fake.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("reconnecting", () => {
  test("a dropped gateway reports offline and retries with doubling delays", () => {
    const { received, slack } = h.connect();
    slack.drop();
    expect(received).toEqual([{ connected: false, type: "_status" }]);
    for (const delay of [2000, 4000, 8000]) {
      const before = h.fake.sockets.length;
      jest.advanceTimersByTime(delay - 1);
      expect(h.fake.sockets).toHaveLength(before);
      jest.advanceTimersByTime(1);
      expect(h.fake.sockets).toHaveLength(before + 1);
      h.fake.last().drop();
    }
  });

  test("the retry delay caps at 60 seconds", () => {
    const { slack } = h.connect();
    slack.drop();
    for (let attempt = 0; attempt < 10; attempt++) {
      jest.advanceTimersByTime(60_000);
      h.fake.last().drop();
    }
    const before = h.fake.sockets.length;
    jest.advanceTimersByTime(60_000);
    expect(h.fake.sockets).toHaveLength(before + 1);
  });

  test("an error followed by a close schedules one retry", () => {
    const { slack } = h.connect();
    slack.fail();
    slack.drop();
    jest.advanceTimersByTime(2000);
    expect(h.fake.sockets).toHaveLength(2);
    jest.advanceTimersByTime(60_000);
    expect(h.fake.sockets).toHaveLength(2);
  });

  test("subscriptions are sent again on the new gateway socket", () => {
    const { client, gateway, slack } = h.connect();
    watch(gateway, client, ["U1", "U2"]);
    slack.drop();
    jest.advanceTimersByTime(2000);
    h.fake.last().accept();
    const types = h.fake
      .last()
      .sentJson()
      .map((msg) => `${msg.type}:${msg.subtype ?? ""}`);
    expect(types).toEqual([
      "presence_sub:",
      "subscription_update:user_change_subscribe_request",
      "subscription_update:dnd_invalidated_subscribe_request",
    ]);
  });

  test("late events from the dead socket are ignored", () => {
    const { received, slack } = h.connect();
    slack.drop();
    jest.advanceTimersByTime(2000);
    received.length = 0;
    slack.receive({ channel: "C1", ts: "1.1", type: "message", user: "U1" });
    expect(received).toEqual([]);
  });
});

describe("liveness", () => {
  test("the gateway is pinged every 30 seconds", () => {
    const { slack } = h.connect();
    jest.advanceTimersByTime(30_000);
    jest.advanceTimersByTime(30_000);
    expect(slack.sentJson().map((msg) => msg.type)).toEqual(["ping", "ping"]);
  });

  test("a gateway that stays silent is dropped and reconnected", () => {
    const { received, slack } = h.connect();
    jest.advanceTimersByTime(120_000);
    expect(received).toContainEqual({ connected: false, type: "_status" });
    expect(slack.readyState).not.toBe(1);
    jest.advanceTimersByTime(2000);
    expect(h.fake.sockets).toHaveLength(2);
  });

  test("any inbound frame keeps the gateway alive", () => {
    const { received, slack } = h.connect();
    for (let tick = 0; tick < 40; tick++) {
      jest.advanceTimersByTime(30_000);
      slack.receive({ type: "pong" });
    }
    expect(received).toEqual([]);
    expect(h.fake.sockets).toHaveLength(1);
  });
});

describe("closing", () => {
  test("closing stops events, pings and retries", () => {
    const hooks: GatewayEvent[] = [];
    const { client, gateway, received, slack } = h.connect([
      { handle: (event) => void hooks.push(event), types: ["message"] },
    ]);
    gateway.close(client);
    slack.drop();
    slack.receive({ channel: "C1", ts: "1.1", type: "message", user: "U1" });
    jest.advanceTimersByTime(600_000);
    expect(slack.sent).toEqual([]);
    expect(hooks).toEqual([]);
    expect(received).toEqual([]);
    expect(h.fake.sockets).toHaveLength(1);
  });

  test("closing while a retry is pending cancels it", () => {
    const { client, gateway, slack } = h.connect();
    slack.drop();
    gateway.close(client);
    jest.advanceTimersByTime(600_000);
    expect(h.fake.sockets).toHaveLength(1);
  });

  test("closing twice and messaging after close are harmless", () => {
    const { client, gateway } = h.connect();
    gateway.close(client);
    expect(() => gateway.close(client)).not.toThrow();
    expect(() => gateway.message(client, '{"type":"typing","channel":"C1"}')).not.toThrow();
  });

  test("many connections opened and closed leave no sockets or timers behind", () => {
    const gateway = createGateway(
      () => [],
      () => [],
    );
    for (let index = 0; index < 200; index++) {
      const client = { send() {} };
      gateway.open(client, creds);
      h.fake.last().accept();
      gateway.close(client);
    }
    const created = h.fake.sockets.length;
    jest.advanceTimersByTime(600_000);
    expect(h.fake.sockets).toHaveLength(created);
    expect(h.fake.sockets.every((socket) => socket.sent.length === 0)).toBe(true);
  });
});
