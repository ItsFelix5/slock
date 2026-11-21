import { describe, expect, test } from "bun:test";
import { trimSyncEvent } from "../../../src/realtime/server/trimSync";

const draft = (overrides: object = {}) => ({
  blocks: [],
  client_msg_id: "m1",
  destinations: [{ channel_id: "C1", thread_ts: "1700000000.000100" }],
  id: "Dr1",
  last_updated_ts: "1700000001.000200",
  ...overrides,
});

describe("trimSyncEvent", () => {
  test("channel may arrive as an id or an object and both give the same event", () => {
    expect(trimSyncEvent({ channel: "C1", type: "channel_changed" })).toEqual(
      trimSyncEvent({ channel: { id: "C1" }, type: "channel_changed" }),
    );
  });

  test("channel_updated takes channels from the list, else from the single channel", () => {
    const listed = trimSyncEvent({ channels: ["C1", 7, "C2"], type: "channel_updated" });
    const single = trimSyncEvent({ channel: { id: "C3" }, type: "channel_updated" });
    expect(listed).toMatchObject({ channels: ["C1", "C2"] });
    expect(single).toMatchObject({ channels: ["C3"] });
    expect(trimSyncEvent({ type: "channel_updated" })).toMatchObject({ channels: [] });
  });

  test("channel_updated reports archive, topic and a posting change", () => {
    expect(
      trimSyncEvent({
        channel: "C1",
        type: "channel_updated",
        updates: { is_archived: true, permissions: { x: 1 }, topic: { value: "t" } },
      }),
    ).toMatchObject({ updates: { archived: true, postingChanged: true, topic: "t" } });
    expect(trimSyncEvent({ channel: "C1", type: "channel_updated", updates: {} })).toMatchObject({
      updates: { postingChanged: undefined },
    });
  });

  test("a complete draft is trimmed to an entry", () => {
    expect(trimSyncEvent({ draft: draft(), type: "draft_update" })).toEqual({
      draft: {
        blocks: [],
        channelId: "C1",
        clientMsgId: "m1",
        id: "Dr1",
        lastUpdatedTs: "1700000001.000200",
        threadTs: "1700000000.000100",
      },
      type: "draft_update",
    });
  });

  test.each([
    ["no draft", undefined],
    ["no id", draft({ id: "" })],
    ["no destinations array", draft({ destinations: undefined })],
    ["no destination", draft({ destinations: [] })],
    ["scheduled", draft({ date_scheduled: 1700000500 })],
  ])("a draft event with %s is dropped", (_name, value) => {
    expect(trimSyncEvent({ draft: value, type: "draft_create" })).toBeNull();
  });

  test("a draft with date_scheduled 0 is not scheduled", () => {
    expect(
      trimSyncEvent({ draft: draft({ date_scheduled: 0 }), type: "draft_create" }),
    ).not.toBeNull();
  });

  test("draft_delete only keeps the id", () => {
    expect(trimSyncEvent({ draft: draft(), draft_id: "Dr1", type: "draft_delete" })).toEqual({
      draft_id: "Dr1",
      type: "draft_delete",
    });
  });

  test("document_change names the file after the channel field", () => {
    expect(trimSyncEvent({ channel: "F1", type: "document_change" })).toEqual({
      file_id: "F1",
      type: "document_change",
    });
  });

  test("user may arrive as id or object", () => {
    expect(trimSyncEvent({ type: "dnd_updated_user", user: { id: "U1" } })).toEqual({
      type: "dnd_updated_user",
      user: "U1",
    });
    expect(trimSyncEvent({ type: "dnd_invalidated", user: "U1" })).toEqual({
      type: "dnd_invalidated",
      user: "U1",
    });
  });

  test("payload fields never leak through bare notifications", () => {
    expect(trimSyncEvent({ channel: "C1", draft: draft(), type: "saved_updated" })).toEqual({
      type: "saved_updated",
    });
  });

  test("unknown event types are dropped", () => {
    expect(trimSyncEvent({ type: "something_new" })).toBeNull();
    expect(trimSyncEvent({})).toBeNull();
  });
});
