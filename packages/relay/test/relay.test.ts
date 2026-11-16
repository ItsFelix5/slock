import { afterEach, beforeEach, describe, expect, test } from "bun:test";

Bun.env.SLACK_BOT_TOKENS = JSON.stringify({ T1: "xoxb-test" });
const { perform } = await import("../src/actions");
const { stashFile, takeFiles } = await import("../src/files");

type Call = { method: string; params: Record<string, string> };

const realFetch = globalThis.fetch;
let calls: Call[];
let replies: Record<string, (params: Record<string, string>) => object>;
let reserved: number;

const onMessage = (files: string[] = []) => ({
  blocks: [{ type: "divider" }],
  bot_id: "B1",
  files: files.map((id) => ({ id })),
  text: "old",
  ts: "5.5",
  username: "felix",
});

beforeEach(() => {
  calls = [];
  reserved = 0;
  replies = {
    "admin.roles.entity.listAssignments": () => ({
      ok: true,
      role_assignments: [{ users: ["U1"] }],
    }),
    "chat.postMessage": () => ({ ok: true, ts: "9.9" }),
    "conversations.replies": () => ({ messages: [onMessage()], ok: true }),
    "files.getUploadURLExternal": () => {
      reserved++;
      return { file_id: `N${reserved}`, ok: true, upload_url: "https://files.slack.test/up" };
    },
    "users.info": () => ({
      ok: true,
      user: { id: "U1", profile: { display_name: "felix", image_192: "https://img/f.png" } },
    }),
  };
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://files.slack.test/")) return Promise.resolve(new Response("ok"));
      const method = url.replace("https://slack.com/api/", "");
      const params = init?.body instanceof URLSearchParams ? Object.fromEntries(init.body) : {};
      calls.push({ method, params });
      return Promise.resolve(Response.json(replies[method]?.(params) ?? { ok: true }));
    },
    { preconnect: () => {} },
  );
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const called = (method: string) => calls.filter((call) => call.method === method);
const sent = (method: string) => called(method)[0]?.params ?? {};
const png = () => [new File(["abc"], "a.png"), new File(["d"], "b.txt")];

describe("posting", () => {
  test("posts as the user", async () => {
    const error = await perform("T1", "C1", "U1", {
      action: "post",
      replyBroadcast: true,
      text: "<!channel> hi",
      threadTs: "1.1",
      unfurl: [],
    });
    expect(error).toBeUndefined();
    expect(sent("chat.postMessage")).toMatchObject({
      channel: "C1",
      icon_url: "https://img/f.png",
      reply_broadcast: "true",
      thread_ts: "1.1",
      unfurl_links: "false",
      username: "felix",
    });
    expect(called("files.getUploadURLExternal")).toEqual([]);
  });

  test("is refused for people who do not manage the channel", async () => {
    replies["admin.roles.entity.listAssignments"] = () => ({ ok: true, role_assignments: [] });
    expect(await perform("T1", "C1", "U1", { action: "post", text: "x" }, png())).toBe(
      "not_a_channel_manager",
    );
    expect(called("files.getUploadURLExternal")).toEqual([]);
  });

  test("uploads files as the bot and attaches them to the message", async () => {
    const error = await perform("T1", "C1", "U1", { action: "post", text: "pics" }, png());
    expect(error).toBeUndefined();
    expect(called("files.getUploadURLExternal").map((call) => call.params.filename)).toEqual([
      "a.png",
      "b.txt",
    ]);
    expect(JSON.parse(sent("files.completeUploadExternal").files ?? "")).toEqual([
      { id: "N1", title: "a.png" },
      { id: "N2", title: "b.txt" },
    ]);
    expect(sent("chat.update")).toEqual({
      channel: "C1",
      file_ids: "N1,N2",
      text: "pics",
      ts: "9.9",
    });
    const methods = calls.map((call) => call.method);
    expect(methods.indexOf("chat.postMessage")).toBeLessThan(methods.indexOf("chat.update"));
  });

  test("removes the message again if the files cannot be attached", async () => {
    replies["chat.update"] = () => ({ error: "file_not_found", ok: false });
    expect(await perform("T1", "C1", "U1", { action: "post", text: "x" }, png())).toBe(
      "file_not_found",
    );
    expect(sent("chat.delete")).toEqual({ channel: "C1", ts: "9.9" });
  });

  test("stops before posting if an upload fails", async () => {
    replies["files.getUploadURLExternal"] = () => ({ error: "missing_scope", ok: false });
    expect(await perform("T1", "C1", "U1", { action: "post", text: "x" }, png())).toBe(
      "missing_scope",
    );
    expect(called("chat.postMessage")).toEqual([]);
  });
});

describe("editing", () => {
  const withFiles = (...ids: string[]) => {
    replies["conversations.replies"] = () => ({ messages: [onMessage(ids)], ok: true });
  };

  test("changes text and blocks", async () => {
    const error = await perform("T1", "C1", "U1", {
      action: "edit",
      blocks: [{ type: "divider" }],
      text: "new",
      ts: "5.5",
    });
    expect(error).toBeUndefined();
    expect(sent("chat.update")).toEqual({
      blocks: '[{"type":"divider"}]',
      channel: "C1",
      text: "new",
      ts: "5.5",
    });
  });

  test("only touches messages the user relayed", async () => {
    replies["conversations.replies"] = () => ({
      messages: [{ ...onMessage(), username: "someone else" }],
      ok: true,
    });
    expect(await perform("T1", "C1", "U1", { action: "edit", text: "x", ts: "5.5" })).toBe(
      "cant_update_message",
    );
    expect(called("chat.update")).toEqual([]);
  });

  test("drops the files that are not in the list to keep", async () => {
    withFiles("F1", "F2", "F3");
    await perform("T1", "C1", "U1", {
      action: "edit",
      fileIds: ["F3", "F1"],
      text: "x",
      ts: "5.5",
    });
    expect(sent("chat.update").file_ids).toBe("F3,F1");
  });

  test("removes every file when told to keep none", async () => {
    withFiles("F1");
    await perform("T1", "C1", "U1", { action: "edit", fileIds: [], text: "x", ts: "5.5" });
    expect(sent("chat.update").file_ids).toBe("");
  });

  test("leaves files alone when the list is unchanged", async () => {
    withFiles("F1", "F2");
    await perform("T1", "C1", "U1", {
      action: "edit",
      fileIds: ["F1", "F2"],
      text: "x",
      ts: "5.5",
    });
    expect(sent("chat.update")).not.toHaveProperty("file_ids");
  });

  test("cannot keep files that are not on the message", async () => {
    withFiles("F1");
    expect(await perform("T1", "C1", "U1", { action: "edit", fileIds: ["F9"], ts: "5.5" })).toBe(
      "invalid_file_ids",
    );
    expect(called("chat.update")).toEqual([]);
  });

  test("broadcasts a reply while keeping its content", async () => {
    await perform("T1", "C1", "U1", { action: "edit", replyBroadcast: true, ts: "5.5" });
    expect(sent("chat.update")).toEqual({
      blocks: '[{"type":"divider"}]',
      channel: "C1",
      reply_broadcast: "true",
      text: "old",
      ts: "5.5",
    });
  });
});

describe("deleting", () => {
  test("removes the message and its files", async () => {
    replies["conversations.replies"] = () => ({ messages: [onMessage(["F1", "F2"])], ok: true });
    expect(await perform("T1", "C1", "U1", { action: "delete", ts: "5.5" })).toBeUndefined();
    expect(sent("chat.delete")).toEqual({ channel: "C1", ts: "5.5" });
    expect(called("files.delete").map((call) => call.params.file)).toEqual(["F1", "F2"]);
  });

  test("only touches messages the user relayed", async () => {
    replies["conversations.replies"] = () => ({ messages: [], ok: true });
    expect(await perform("T1", "C1", "U1", { action: "delete", ts: "5.5" })).toBe(
      "cant_update_message",
    );
    expect(called("chat.delete")).toEqual([]);
  });
});

describe("uploads waiting for their command", () => {
  test("are handed over once, in order", () => {
    expect(stashFile("up-0123456789abcdef", new File(["a"], "a.png"))).toBe(true);
    expect(stashFile("up-0123456789abcdef", new File(["b"], "b.png"))).toBe(true);
    expect(takeFiles("up-0123456789abcdef")?.map((file) => file.name)).toEqual(["a.png", "b.png"]);
    expect(takeFiles("up-0123456789abcdef")).toBeUndefined();
  });

  test("are refused once too many bytes are held", () => {
    const big = new File([new Uint8Array(200 * 1024 * 1024)], "big.bin");
    expect(stashFile("up-big-0123456789abcd", big)).toBe(true);
    expect(stashFile("up-big2-0123456789abc", big)).toBe(false);
    takeFiles("up-big-0123456789abcd");
    expect(stashFile("up-big2-0123456789abc", big)).toBe(true);
    takeFiles("up-big2-0123456789abc");
  });
});
