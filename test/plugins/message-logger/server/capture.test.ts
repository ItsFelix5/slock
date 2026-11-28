import { beforeEach, describe, expect, test } from "bun:test";
import type { RawMessage } from "@slock/types";
import { captureDeleted } from "../../../../packages/plugins/src/message-logger/server/capture";
import {
  createLogStore,
  type LogStore,
} from "../../../../packages/plugins/src/message-logger/server/store";
import type { GatewayEvent } from "../../../../packages/plugins/src/realtime/server/api";
import type { Credentials } from "../../../../packages/plugins/src/slack/server/api/auth";
import { createFakeEnv } from "../../../support/core";
import { ch } from "../../../support/slack";

let store: LogStore;

beforeEach(() => {
  store = createLogStore(":memory:", createFakeEnv());
});

function credsFor(route: string): Credentials {
  return { domain: "x.slack.com", route, slackSession: "d", token: `xoxc-${route}` };
}

function deletion(extra: Record<string, unknown> = {}): GatewayEvent {
  const previous: RawMessage = { text: "oops", ts: "1700000001.000100", user: "U1" };
  return {
    channel: "C1",
    previous_message: previous,
    subtype: "message_deleted",
    type: "message",
    ...extra,
  };
}

describe("captureDeleted", () => {
  test("listens to message events only", () => {
    expect(captureDeleted(store).types).toEqual(["message"]);
  });

  test("keeps a deleted message under the workspace of the connection that saw it", () => {
    captureDeleted(store).handle(deletion(), credsFor("E1:T1"));
    expect(store.channelMessages("T1", ch("C1"), {}).map((m) => m.text)).toEqual(["oops"]);
    expect(store.channelMessages("T2", ch("C1"), {})).toEqual([]);
  });

  test("two connections seeing the same deletion store one copy", () => {
    const hook = captureDeleted(store);
    hook.handle(deletion(), credsFor("T1"));
    hook.handle(deletion(), credsFor("T1"));
    expect(store.channelMessages("T1", ch("C1"), {})).toHaveLength(1);
  });

  test.each([
    ["other subtype", { subtype: "message_changed" }],
    ["no subtype", { subtype: undefined }],
    ["missing channel", { channel: undefined }],
    ["numeric channel", { channel: 12 }],
    ["missing previous message", { previous_message: undefined }],
    ["null previous message", { previous_message: null }],
    ["previous message without ts", { previous_message: { text: "x" } }],
    ["string previous message", { previous_message: "oops" }],
  ])("ignores %s", (_name, extra) => {
    captureDeleted(store).handle(deletion(extra), credsFor("T1"));
    expect(store.channelMessages("T1", ch("C1"), {})).toEqual([]);
  });
});
