import { describe, expect, test } from "bun:test";
import setup from "../../../../packages/plugins/src/activity/server/index";
import { activityEventTrim } from "../../../../packages/plugins/src/activity/server/trim";
import { creds, fakeSlackServer } from "../../../support/slackServer";

const { calls, replies, request, slackMethods } = fakeSlackServer("activity", setup);

describe("POST /api/activity/archive", () => {
  const reminder = { key: "k1", linkedItemId: "Rm1", ts: "5.5", type: "saved_reminder" };

  test("completes the linked reminder before archiving", async () => {
    const { status } = await request("/api/activity/archive", reminder);
    expect(status).toBe(200);
    expect(slackMethods()).toEqual(["saved.update", "activity.archive"]);
    const update = calls[0]?.params;
    expect(update?.get("item_id")).toBe("Rm1");
    expect(update?.get("item_type")).toBe("reminder");
    expect(update?.get("mark")).toBe("completed");
    expect(update?.get("date_due")).toBe("0");
    expect(calls[1]?.params.get("key")).toBe("k1");
  });

  test("does not archive when completing the reminder fails", async () => {
    replies["saved.update"] = { error: "saved_item_not_found", ok: false };
    const { json, status } = await request("/api/activity/archive", reminder);
    expect(slackMethods()).toEqual(["saved.update"]);
    expect(status).not.toBe(200);
    expect(JSON.stringify(json)).toContain("saved_item_not_found");
  });

  test.each([
    ["a reminder without a linked item", { ...reminder, linkedItemId: undefined }],
    ["another activity type", { ...reminder, type: "at_user" }],
  ])("only archives for %s", async (_name, body) => {
    await request("/api/activity/archive", body);
    expect(slackMethods()).toEqual(["activity.archive"]);
  });

  test.each(["key", "ts", "type"])("rejects a body without %s", async (field) => {
    const { status } = await request("/api/activity/archive", { ...reminder, [field]: "" });
    expect(status).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe("POST /api/activity/read", () => {
  test("marks read without completing the reminder", async () => {
    const { status } = await request("/api/activity/read", {
      feedTs: "5.5",
      key: "k1",
      linkedItemId: "Rm1",
      type: "saved_reminder",
    });
    expect(status).toBe(200);
    expect(slackMethods()).toEqual(["activity.markRead"]);
    expect(calls[0]?.params.get("feed_ts")).toBe("5.5");
  });

  test("rejects a body without a feed ts", async () => {
    const { status } = await request("/api/activity/read", { key: "k1", type: "at_user" });
    expect(status).toBe(400);
  });
});

describe("GET /api/activity", () => {
  const feed = (items: object[]) => {
    replies["activity.feed"] = { items, ok: true };
  };
  const reminderItem = (id: string, type = "reminder", ts = "0000000000.000000") => ({
    feed_ts: "9.9",
    is_unread: true,
    item: {
      saved_reminder_payload: { item_id: id, item_id_2: ts, item_type: type },
      type: "saved_reminder",
    },
    key: `reminder:${id}`,
  });
  const description = (text: string) => [
    {
      elements: [{ elements: [{ text, type: "text" }], type: "rich_text_section" }],
      type: "rich_text",
    },
  ];

  test("fills a text reminder with its description and completable id", async () => {
    feed([reminderItem("Sa1")]);
    replies["saved.get"] = {
      ok: true,
      saved_items: [
        { description: description("buy milk"), item_id: "Sa1", item_type: "reminder" },
      ],
    };
    const { json } = await request("/api/activity");
    expect(json.items[0].item).toMatchObject({
      activity_text: "buy milk",
      linked_item_id: "Sa1",
      type: "saved_reminder",
    });
    expect(json.items[0].item.channel_id).toBeUndefined();
  });

  test("points a message reminder at its message and keeps the note", async () => {
    feed([reminderItem("C1", "message", "3.3")]);
    replies["saved.get"] = {
      ok: true,
      saved_items: [
        {
          description: description("reply to this"),
          item_id: "C1",
          item_type: "message",
          ts: "3.3",
        },
      ],
    };
    const { json } = await request("/api/activity");
    expect(json.items[0].item).toMatchObject({
      channel_id: "C1",
      message_ts: "3.3",
      reminder_note: "reply to this",
    });
    expect(json.items[0].item.linked_item_id).toBeUndefined();
  });

  test("asks Slack about each reminder once", async () => {
    feed([reminderItem("Sa1"), reminderItem("Sa1"), reminderItem("Sa2")]);
    await request("/api/activity");
    const asked = JSON.parse(
      calls.find((call) => call.method === "saved.get")?.params.get("items") ?? "[]",
    );
    expect(asked.map((entry: { item_id: string }) => entry.item_id)).toEqual(["Sa1", "Sa2"]);
  });

  test("skips the saved lookup when there is no reminder", async () => {
    feed([{ feed_ts: "1.1", item: { type: "at_user" }, key: "k" }]);
    await request("/api/activity");
    expect(slackMethods()).toEqual(["activity.feed"]);
  });

  test("still answers when the saved lookup fails", async () => {
    feed([reminderItem("Sa1")]);
    replies["saved.get"] = { error: "boom", ok: false };
    const { json, status } = await request("/api/activity");
    expect(status).toBe(200);
    expect(json.items[0].item.type).toBe("saved_reminder");
  });
});

describe("live activity frames", () => {
  const trim = (entry: object, subtype = "activity_updated") =>
    activityEventTrim.trim({ entry, subtype, type: "activity" }, creds);

  test("keep the entry and drop what the client does not read", () => {
    const item = { secret: "x", type: "at_user" };
    expect(JSON.parse(JSON.stringify(trim({ feed_ts: "1.1", item, key: "k" })))).toEqual({
      entry: { feed_ts: "1.1", item: { type: "at_user" }, key: "k" },
      subtype: "activity_updated",
      type: "activity",
    });
  });

  test("ask for a refetch when a reminder needs its saved text", () => {
    const item = { saved_reminder_payload: { item_id: "Sa1" }, type: "saved_reminder" };
    expect(trim({ feed_ts: "1.1", item, key: "k" })).toEqual({
      subtype: "activity_invalidated",
      type: "activity",
    });
  });
});
