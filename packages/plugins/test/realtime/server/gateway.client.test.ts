import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createGatewayHarness, creds, watch } from "../support/gatewayHarness";

let h: ReturnType<typeof createGatewayHarness>;

beforeEach(() => {
  h = createGatewayHarness();
});

afterEach(() => {
  h.fake.restore();
});

describe("connecting", () => {
  test("without credentials only the offline status is sent", () => {
    const gateway = h.create();
    const received: string[] = [];
    gateway.open({ send: (data) => void received.push(data) }, null);
    expect(received).toEqual(['{"connected":false,"type":"_status"}']);
    expect(h.fake.sockets).toHaveLength(0);
  });

  test("the gateway url carries the token, enterprise and cookie", () => {
    const gateway = h.create();
    const received: Record<string, unknown>[] = [];
    gateway.open({ send: (data) => void received.push(JSON.parse(data)) }, creds);
    const url = new URL(h.fake.last().url);
    expect(url.searchParams.get("token")).toBe("xoxc-token");
    expect(url.searchParams.get("enterprise_id")).toBe("E1");
    expect(url.searchParams.get("gateway_server")).toMatch(/^T1-[123]$/);
    expect(h.fake.last().init).toEqual({ headers: { cookie: "d=session-cookie" } });
    expect(received).toEqual([{ connected: false, type: "_status" }]);
    h.fake.last().accept();
    expect(received.at(-1)).toEqual({ connected: true, type: "_status" });
  });

  test("a constructor failure schedules a retry", () => {
    const original = globalThis.WebSocket;
    let attempts = 0;
    Object.assign(globalThis, {
      WebSocket: class {
        constructor() {
          attempts++;
          throw new Error("dns");
        }
      },
    });
    const gateway = h.create();
    gateway.open({ send() {} }, creds);
    expect(attempts).toBe(1);
    h.env.advance(2000);
    expect(attempts).toBe(2);
    h.env.advance(4000);
    expect(attempts).toBe(3);
    Object.assign(globalThis, { WebSocket: original });
  });
});

describe("client messages", () => {
  test("a client ping is answered even without a connection", () => {
    const gateway = h.create();
    const sent: string[] = [];
    gateway.message({ send: (data) => void sent.push(data) }, '{"type":"ping"}');
    expect(sent).toEqual(['{"type":"pong"}']);
  });

  test("watch_presence subscribes in chunks of 100 and only sends the difference", () => {
    const { client, gateway, slack } = h.connect();
    const ids = Array.from({ length: 250 }, (_, index) => `U${index}`);
    watch(gateway, client, [...ids, 7, null]);
    const updates = slack.sentJson().filter((msg) => msg.type === "subscription_update");
    expect(slack.sentJson()[0]).toEqual({ ids, type: "presence_sub" });
    expect(updates.filter((msg) => msg.subtype === "user_change_subscribe_request")).toHaveLength(
      3,
    );
    expect(
      updates.filter((msg) => msg.subtype === "dnd_invalidated_subscribe_request"),
    ).toHaveLength(3);
    slack.sent.length = 0;
    watch(gateway, client, ids.slice(10));
    const second = slack.sentJson().filter((msg) => msg.type === "subscription_update");
    expect(second.map((msg) => msg.subtype)).toEqual([
      "user_change_unsubscribe_request",
      "dnd_invalidated_unsubscribe_request",
    ]);
    expect(second[0]?.ids).toEqual(ids.slice(0, 10));
  });

  test("watching before the gateway opens is sent once it opens", () => {
    const gateway = h.create();
    const client = { send() {} };
    gateway.open(client, creds);
    const slack = h.fake.last();
    watch(gateway, client, ["U1"]);
    expect(slack.sent).toHaveLength(0);
    slack.accept();
    expect(slack.sentJson().map((msg) => msg.type)).toEqual([
      "presence_sub",
      "subscription_update",
      "subscription_update",
    ]);
  });

  test("typing is forwarded with its thread and bad shapes are ignored", () => {
    const { client, gateway, slack } = h.connect();
    gateway.message(client, '{"type":"typing","channel":"C1","thread_ts":"1.1"}');
    gateway.message(client, '{"type":"typing","channel":7}');
    gateway.message(client, "{broken");
    expect(slack.sentJson()).toMatchObject([{ channel: "C1", thread_ts: "1.1", type: "typing" }]);
  });

  test("typing before the gateway is open does not throw", () => {
    const gateway = h.create();
    const client = { send() {} };
    gateway.open(client, creds);
    expect(() => gateway.message(client, '{"type":"typing","channel":"C1"}')).not.toThrow();
  });

  test("tickle is forwarded only while the gateway is open", () => {
    const { client, gateway, slack } = h.connect();
    gateway.message(client, '{"type":"tickle"}');
    expect(slack.sentJson()).toEqual([{ reason: "focus", type: "tickle" }]);
  });
});
