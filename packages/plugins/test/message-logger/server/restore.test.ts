import { beforeEach, describe, expect, test } from "bun:test";
import { runHttp } from "@slock/core";
import { createFakeEnv } from "@slock/core/testing";
import { ch, stamp } from "@slock/slack/testing";
import type { RawMessage } from "@slock/types";
import { restoreDeleted } from "../../../src/message-logger/server/restore";
import { createLogStore, type LogStore } from "../../../src/message-logger/server/store";
import type { Credentials } from "../../../src/slack/server/api/auth";

let store: LogStore;

beforeEach(() => {
  store = createLogStore(":memory:", createFakeEnv());
});

function credsFor(team: string, token = `xoxc-${team}`): Credentials {
  return { domain: `${team}.slack.com`, route: team, slackSession: "d", token };
}

function message(ts: string, extra: Partial<RawMessage> = {}): RawMessage {
  return { text: `text ${ts}`, ts, user: "U1", ...extra };
}

function slackPage(messages: RawMessage[], extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ has_more: false, messages, ok: true, ...extra }), {
    headers: { "content-type": "application/json" },
  });
}

async function request(
  path: string,
  creds: Credentials | null,
  upstream: () => Response,
  method = "GET",
) {
  const url = new URL(path, "http://slock.test");
  const res = await runHttp([async () => upstream(), restoreDeleted(store)], {
    creds,
    upgrade: () => false,
    req: new Request(url, { method }),
    url,
  });
  return res;
}

async function tsList(res: Response | undefined) {
  const body = (await res?.json()) as { messages: RawMessage[] };
  return body.messages.map((m) => m.ts);
}

describe("channel history", () => {
  test("merges deleted messages into the page newest first", async () => {
    store.saveMessage("T1", ch("C1"), message("1700000002.000100"));
    const res = await request("/api/channels/C1/messages", credsFor("T1"), () =>
      slackPage([message("1700000003.000100"), message("1700000001.000100")]),
    );
    expect(await tsList(res)).toEqual([
      "1700000003.000100",
      "1700000002.000100",
      "1700000001.000100",
    ]);
  });

  test("never duplicates a message Slack still returns", async () => {
    store.saveMessage("T1", ch("C1"), message("1700000002.000100"));
    const res = await request("/api/channels/C1/messages", credsFor("T1"), () =>
      slackPage([message("1700000002.000100")]),
    );
    expect(await tsList(res)).toEqual(["1700000002.000100"]);
  });

  test("restored messages carry the deleted flag", async () => {
    store.saveMessage("T1", ch("C1"), message("1700000002.000100"));
    const res = await request("/api/channels/C1/messages", credsFor("T1"), () => slackPage([]));
    const body = (await res?.json()) as { messages: RawMessage[] };
    expect(body.messages[0]?.deleted).toBe(true);
  });

  test("a deleted message from before the page is not restored when more history exists", async () => {
    store.saveMessage("T1", ch("C1"), message("1700000001.000100"));
    const res = await request("/api/channels/C1/messages", credsFor("T1"), () =>
      slackPage([message("1700000005.000100"), message("1700000004.000100")], { has_more: true }),
    );
    expect(await tsList(res)).toEqual(["1700000005.000100", "1700000004.000100"]);
  });

  test("honours the latest bound", async () => {
    store.saveMessage("T1", ch("C1"), message("1700000009.000100"));
    store.saveMessage("T1", ch("C1"), message("1700000002.000100"));
    const res = await request(
      "/api/channels/C1/messages?latest=1700000005.000000",
      credsFor("T1"),
      () => slackPage([]),
    );
    expect(await tsList(res)).toEqual(["1700000002.000100"]);
  });
});

describe("threads", () => {
  test("replies come back oldest first", async () => {
    const root = stamp("1700000001.000100");
    store.saveMessage("T1", ch("C1"), message("1700000003.000100", { thread_ts: root }));
    const res = await request(`/api/channels/C1/threads/${root}/messages`, credsFor("T1"), () =>
      slackPage([
        message(root, { thread_ts: root }),
        message("1700000004.000100", { thread_ts: root }),
      ]),
    );
    expect(await tsList(res)).toEqual([root, "1700000003.000100", "1700000004.000100"]);
  });
});

describe("tenant isolation", () => {
  beforeEach(() => {
    store.saveMessage("T1", ch("C1"), message("1700000002.000100", { text: "T1 secret" }));
    store.saveMessage(
      "T1",
      ch("C1"),
      message("1700000003.000100", { thread_ts: "1700000001.000100" }),
    );
  });

  test("another workspace asking for the same channel id gets nothing extra", async () => {
    const res = await request("/api/channels/C1/messages", credsFor("T2"), () => slackPage([]));
    expect(await tsList(res)).toEqual([]);
  });

  test("another workspace asking for the same thread gets nothing extra", async () => {
    const res = await request(
      "/api/channels/C1/threads/1700000001.000100/messages",
      credsFor("T2"),
      () => slackPage([]),
    );
    expect(await tsList(res)).toEqual([]);
  });

  test("a different route format for the same team still matches", async () => {
    const res = await request("/api/channels/C1/messages", credsFor("E1:T1"), () => slackPage([]));
    expect(await tsList(res)).toEqual(["1700000002.000100"]);
  });

  test("slack refusing access means nothing is restored", async () => {
    const res = await request(
      "/api/channels/C1/messages",
      credsFor("T1"),
      () =>
        new Response(JSON.stringify({ error: "channel_not_found", ok: false }), { status: 404 }),
    );
    expect(res?.status).toBe(404);
    expect(JSON.stringify(await res?.json())).not.toContain("T1 secret");
  });

  test("requests without credentials are passed through untouched", async () => {
    const res = await request("/api/channels/C1/messages", null, () => slackPage([]));
    expect(await tsList(res)).toEqual([]);
  });
});

describe("pass through", () => {
  test("non GET and unrelated paths are not rewritten", async () => {
    store.saveMessage("T1", ch("C1"), message("1700000002.000100"));
    const post = await request(
      "/api/channels/C1/messages",
      credsFor("T1"),
      () => slackPage([]),
      "POST",
    );
    expect(await tsList(post)).toEqual([]);
    const other = await request("/api/channels/C1/members", credsFor("T1"), () => slackPage([]));
    expect(await tsList(other)).toEqual([]);
  });
});
