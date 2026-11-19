import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type {
  GatewayEvent,
  RealtimeEventHook,
  RealtimeTrim,
} from "../../../src/realtime/server/api";
import { createGatewayHarness, creds } from "../../../src/realtime/testing/gatewayHarness";
import type { Credentials } from "../../../src/slack/server/api/auth";

let h: ReturnType<typeof createGatewayHarness>;

beforeEach(() => {
  h = createGatewayHarness();
});

afterEach(() => {
  h.fake.restore();
});

describe("event flow", () => {
  test("events reach the client in arrival order, duplicates and reordering included", () => {
    const { received, slack } = h.connect();
    const message = (ts: string) => ({ channel: "C1", text: ts, ts, type: "message", user: "U1" });
    for (const ts of ["3.3", "1.1", "3.3", "2.2"]) slack.receive(message(ts));
    expect(received.map((event) => event.ts)).toEqual(["3.3", "1.1", "3.3", "2.2"]);
  });

  test("new gateway handlers produce the trimmed wire shapes", () => {
    const { received, slack } = h.connect();
    slack.receive({
      channel: "C1",
      hidden: true,
      is_locked: true,
      subtype: "message_locked",
      thread_ts: "1.1",
      ts: "2.2",
      type: "message",
    });
    slack.receive({ dnd_status: { dnd_enabled: true }, type: "dnd_updated_user", user: "U2" });
    slack.receive({ type: "dnd_invalidated", user: "U3" });
    slack.receive({
      draft: {
        client_msg_id: "c1",
        destinations: [{ channel_id: "C1" }],
        id: "Dr1",
        last_updated_ts: "5.5",
      },
      type: "draft_create",
    });
    slack.receive({ draft_id: "Dr1", type: "draft_delete" });
    slack.receive({ draft_id: "Dr2", type: "draft_send" });
    expect(received.map((event) => event.type)).toEqual([
      "message",
      "dnd_updated_user",
      "dnd_invalidated",
      "draft_create",
      "draft_delete",
      "draft_send",
    ]);
    expect(received[0]).toMatchObject({
      is_locked: true,
      subtype: "message_locked",
      thread_ts: "1.1",
    });
    expect(received[1]).toEqual({ type: "dnd_updated_user", user: "U2" });
    expect(received[3]).toMatchObject({ draft: { channelId: "C1", id: "Dr1" } });
  });

  test("a delete arriving before its create and repeated deletes are all forwarded", () => {
    const { received, slack } = h.connect();
    const draft = { destinations: [{ channel_id: "C1" }], id: "Dr1" };
    slack.receive({ draft_id: "Dr1", type: "draft_delete" });
    slack.receive({ draft, type: "draft_create" });
    slack.receive({ draft_id: "Dr1", type: "draft_delete" });
    slack.receive({ draft_id: "Dr1", type: "draft_delete" });
    expect(received.map((event) => event.type)).toEqual([
      "draft_delete",
      "draft_create",
      "draft_delete",
      "draft_delete",
    ]);
  });

  test("unknown events and broken frames are dropped and later events still flow", () => {
    const { received, slack } = h.connect();
    slack.receive({ type: "made_up_event" });
    slack.receive("{not json");
    slack.receive({ draft: { id: "Dr1" }, type: "draft_create" });
    slack.receive({ channel: "C1", ts: "1.1", type: "message", user: "U1" });
    expect(received.map((event) => event.type)).toEqual(["message"]);
  });

  test("hooks only see their types and receive the credentials", () => {
    const seen: [GatewayEvent, Credentials][] = [];
    const hook: RealtimeEventHook = {
      handle: (event, c) => void seen.push([event, c]),
      types: ["message"],
    };
    const { slack } = h.connect([hook]);
    slack.receive({ channel: "C1", ts: "1.1", type: "message", user: "U1" });
    slack.receive({ type: "dnd_invalidated", user: "U3" });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[1]).toBe(creds);
  });

  test("a throwing hook does not stop other hooks or the client event", () => {
    const calls: string[] = [];
    const bad: RealtimeEventHook = {
      handle() {
        throw new Error("hook bug");
      },
      types: ["message"],
    };
    const good: RealtimeEventHook = { handle: () => void calls.push("good"), types: ["message"] };
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const { received, slack } = h.connect([bad, good]);
    slack.receive({ channel: "C1", ts: "1.1", type: "message", user: "U1" });
    errors.mockRestore();
    expect(calls).toEqual(["good"]);
    expect(received).toHaveLength(1);
  });

  test("a custom trim replaces the default and can suppress an event", () => {
    const trim: RealtimeTrim = {
      trim: (event) => (event.user === "U9" ? null : { type: "message", user: "custom" }),
      types: ["message"],
    };
    const { received, slack } = h.connect([], [trim]);
    slack.receive({ channel: "C1", ts: "1.1", type: "message", user: "U1" });
    slack.receive({ channel: "C1", ts: "1.2", type: "message", user: "U9" });
    expect(received).toEqual([{ type: "message", user: "custom" }]);
  });
});
