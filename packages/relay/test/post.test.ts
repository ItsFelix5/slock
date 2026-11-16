import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  called,
  calls,
  handleApi,
  installSlack,
  json,
  multipart,
  paramsOf,
  responders,
  restoreSlack,
  uploads,
  who,
} from "./harness";

beforeEach(installSlack);
afterEach(restoreSlack);

describe("posting", () => {
  test("posts as the user and returns the timestamp", async () => {
    const res = await handleApi(
      json("POST", "/channels/C1/messages", {
        blocks: [{ type: "divider" }],
        replyBroadcast: true,
        text: "<!channel> hi",
        threadTs: "1.1",
        unfurl: [],
      }),
      who,
    );
    expect(await res.json()).toEqual({ ok: true, ts: "9.9" });
    expect(paramsOf("chat.postMessage")).toMatchObject({
      channel: "C1",
      icon_url: "https://img/felix.png",
      reply_broadcast: "true",
      text: "<!channel> hi",
      thread_ts: "1.1",
      unfurl_links: "false",
      unfurl_media: "false",
      username: "felix",
    });
    expect(paramsOf("chat.postMessage").blocks).toBe('[{"type":"divider"}]');
  });

  test("ignores replyBroadcast outside a thread", async () => {
    await handleApi(
      json("POST", "/channels/C1/messages", { replyBroadcast: true, text: "x" }),
      who,
    );
    expect(paramsOf("chat.postMessage")).not.toHaveProperty("reply_broadcast");
  });

  test("refuses people who do not manage the channel", async () => {
    responders["admin.roles.entity.listAssignments"] = () => ({ ok: true, role_assignments: [] });
    const res = await handleApi(json("POST", "/channels/C1/messages", { text: "x" }), who);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "not_a_channel_manager", ok: false });
    expect(called("chat.postMessage")).toEqual([]);
  });

  test("uploads files as the bot and attaches them to the message", async () => {
    const res = await handleApi(
      multipart("POST", "/channels/C1/messages", { blocks: [{ type: "divider" }], text: "pics" }, [
        "a.png",
        "b.txt",
      ]),
      who,
    );
    expect(await res.json()).toEqual({ ok: true, ts: "9.9" });
    expect(uploads).toEqual(["a.png", "b.txt"]);
    expect(paramsOf("files.getUploadURLExternal")).toMatchObject({
      filename: "a.png",
      length: "5",
    });
    expect(JSON.parse(paramsOf("files.completeUploadExternal").files ?? "")).toEqual([
      { id: "N1", title: "a.png" },
      { id: "N2", title: "b.txt" },
    ]);
    const methods = calls.map((call) => call.method);
    expect(methods.indexOf("files.completeUploadExternal")).toBeLessThan(
      methods.indexOf("chat.postMessage"),
    );
    expect(paramsOf("chat.update")).toMatchObject({
      channel: "C1",
      file_ids: "N1,N2",
      text: "pics",
      ts: "9.9",
    });
    expect(paramsOf("chat.update").blocks).toBe('[{"type":"divider"}]');
  });

  test("does not upload anything for someone who cannot post", async () => {
    responders["admin.roles.entity.listAssignments"] = () => ({ ok: true, role_assignments: [] });
    await handleApi(multipart("POST", "/channels/C1/messages", { text: "x" }, ["a.png"]), who);
    expect(uploads).toEqual([]);
  });

  test("removes the message again if the files cannot be attached", async () => {
    responders["chat.update"] = () => ({ error: "file_not_found", ok: false });
    const res = await handleApi(
      multipart("POST", "/channels/C1/messages", { text: "x" }, ["a.png"]),
      who,
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "file_not_found", ok: false });
    expect(paramsOf("chat.delete")).toEqual({ channel: "C1", ts: "9.9" });
    expect(called("files.delete").map((call) => call.params.file)).toEqual(["N1"]);
  });

  test("discards the uploaded files if the message cannot be posted", async () => {
    responders["chat.postMessage"] = () => ({ error: "channel_not_found", ok: false });
    const res = await handleApi(
      multipart("POST", "/channels/C1/messages", { text: "x" }, ["a.png", "b.txt"]),
      who,
    );
    expect(await res.json()).toEqual({ error: "channel_not_found", ok: false });
    expect(called("files.delete").map((call) => call.params.file)).toEqual(["N1", "N2"]);
  });

  test("reports upload failures without posting", async () => {
    responders["files.getUploadURLExternal"] = () => ({ error: "missing_scope", ok: false });
    const res = await handleApi(
      multipart("POST", "/channels/C1/messages", { text: "x" }, ["a.png"]),
      who,
    );
    expect(await res.json()).toEqual({ error: "missing_scope", ok: false });
    expect(called("chat.postMessage")).toEqual([]);
  });
});
