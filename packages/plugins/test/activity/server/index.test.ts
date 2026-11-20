import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createHost, runHttp } from "@slock/core";
import { setHost } from "@slock/core/solid";
import setup from "../../../src/activity/server/index";
import type { Credentials } from "../../../src/slack/server/api/auth";

const creds: Credentials = {
  domain: "team.slack.com",
  route: "T1",
  slackSession: "session",
  token: "xoxc-1",
};

type SlackCall = { method: string; params: URLSearchParams };
type Replies = Record<string, object | undefined>;

let calls: SlackCall[];
let replies: Replies;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

beforeEach(() => {
  calls = [];
  replies = {};
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((
    input: URL | RequestInfo,
    init?: RequestInit,
  ) => {
    const method = new URL(String(input)).pathname.replace("/api/", "");
    const body = init?.body;
    const params = new URLSearchParams();
    const entries =
      body instanceof FormData ? [...body.entries()] : [...new URLSearchParams(String(body))];
    for (const [key, value] of entries) params.append(key, String(value));
    calls.push({ method, params });
    return Promise.resolve(Response.json(replies[method] ?? { ok: true }));
  }) as typeof fetch);
});

afterEach(() => fetchSpy.mockRestore());

async function request(path: string, body?: object) {
  const host = createHost();
  setHost(host);
  await host.register({
    id: "slack",
    setup: (ctx) => ctx.provide("slack.inFlight", { pending: new Map() }),
  });
  await host.register({ id: "activity", setup });
  const url = new URL(`http://localhost${path}`);
  const req = new Request(url, {
    body: body ? JSON.stringify(body) : undefined,
    method: body ? "POST" : "GET",
  });
  const res = await runHttp(host.items("http"), { creds, req, upgrade: () => false, url });
  return { json: await res?.json(), status: res?.status };
}

const slackMethods = () => calls.map((call) => call.method);

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
