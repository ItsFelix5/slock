import { afterEach, beforeEach, describe, expect, test } from "bun:test";

Bun.env.SLACK_BOT_TOKENS = JSON.stringify({ T1: "xoxb-test" });
const { perform } = await import("../src/actions");
const { claimUploads, reserveUpload } = await import("../src/reservations");

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
      return { file_id: `R${reserved}`, ok: true, upload_url: "https://files.slack.test/up" };
    },
    "users.info": () => ({
      ok: true,
      user: { id: "U1", profile: { display_name: "felix", image_192: "https://img/f.png" } },
    }),
  };
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
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
const uploaded = [
  { id: "N1", title: "a.png" },
  { id: "N2", title: "b.txt" },
];

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
    const error = await perform("T1", "C1", "U1", { action: "post", files: uploaded, text: "x" });
    expect(error).toBe("not_a_channel_manager");
    expect(called("files.completeUploadExternal")).toEqual([]);
  });

  test("finishes the uploaded files as the bot and attaches them to the message", async () => {
    const error = await perform("T1", "C1", "U1", {
      action: "post",
      files: uploaded,
      text: "pics",
    });
    expect(error).toBeUndefined();
    expect(JSON.parse(sent("files.completeUploadExternal").files ?? "")).toEqual(uploaded);
    expect(sent("chat.update")).toEqual({
      channel: "C1",
      file_ids: "N1,N2",
      text: "pics",
      ts: "9.9",
    });
    const methods = calls.map((call) => call.method);
    expect(methods.indexOf("files.completeUploadExternal")).toBeLessThan(
      methods.indexOf("chat.postMessage"),
    );
    expect(methods.indexOf("chat.postMessage")).toBeLessThan(methods.indexOf("chat.update"));
  });

  test("only passes an id and a title on to Slack", async () => {
    const extra = [{ id: "N1", other: "x", title: "a.png" }];
    await perform("T1", "C1", "U1", { action: "post", files: extra, text: "x" });
    expect(JSON.parse(sent("files.completeUploadExternal").files ?? "")).toEqual([
      { id: "N1", title: "a.png" },
    ]);
  });

  test("removes the message again if the files cannot be attached", async () => {
    replies["chat.update"] = () => ({ error: "file_not_found", ok: false });
    const error = await perform("T1", "C1", "U1", { action: "post", files: uploaded, text: "x" });
    expect(error).toBe("file_not_found");
    expect(sent("chat.delete")).toEqual({ channel: "C1", ts: "9.9" });
  });

  test("stops before posting if the files cannot be finished", async () => {
    replies["files.completeUploadExternal"] = () => ({ error: "access_denied", ok: false });
    const error = await perform("T1", "C1", "U1", { action: "post", files: uploaded, text: "x" });
    expect(error).toBe("access_denied");
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

describe("reserved uploads", () => {
  test("are reserved with the bot and claimed once by the command", async () => {
    const reply = await reserveUpload("T1", "a.png", "3");
    if (!reply.ok) throw new Error("reservation failed");
    expect(sent("files.getUploadURLExternal")).toEqual({ filename: "a.png", length: "3" });
    expect(reply.upload_url).toBe("https://files.slack.test/up");
    expect(claimUploads([reply.file_id])).toBe(true);
    expect(claimUploads([reply.file_id])).toBe(false);
  });

  test("cannot be claimed for files nobody reserved", () => {
    expect(claimUploads(["F-someone-elses"])).toBe(false);
  });

  test("are all or nothing", async () => {
    const reply = await reserveUpload("T1", "a.png", "3");
    if (!reply.ok) throw new Error("reservation failed");
    expect(claimUploads([reply.file_id, "F-other"])).toBe(false);
    expect(claimUploads([reply.file_id])).toBe(true);
  });

  test("are not remembered when Slack refuses", async () => {
    replies["files.getUploadURLExternal"] = () => ({ error: "missing_scope", ok: false });
    expect(await reserveUpload("T1", "a.png", "3")).toEqual({ error: "missing_scope", ok: false });
    expect(claimUploads(["R0"])).toBe(false);
  });
});
