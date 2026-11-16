import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  called,
  handleApi,
  installSlack,
  json,
  message,
  multipart,
  paramsOf,
  responders,
  restoreSlack,
  who,
} from "./harness";

beforeEach(installSlack);
afterEach(restoreSlack);

describe("editing", () => {
  test("edits text and blocks", async () => {
    const res = await handleApi(
      json("PATCH", "/channels/C1/messages/5.5", { blocks: [{ type: "divider" }], text: "new" }),
      who,
    );
    expect(await res.json()).toEqual({ ok: true, ts: "5.5" });
    expect(paramsOf("chat.update")).toEqual({
      blocks: '[{"type":"divider"}]',
      channel: "C1",
      text: "new",
      ts: "5.5",
    });
  });

  test("only edits messages the user relayed", async () => {
    responders["conversations.replies"] = () => ({
      messages: [{ ...message(), username: "someone else" }],
      ok: true,
    });
    const res = await handleApi(json("PATCH", "/channels/C1/messages/5.5", { text: "x" }), who);
    expect(res.status).toBe(403);
    expect(called("chat.update")).toEqual([]);
  });

  test("keeps only the listed files and adds new ones", async () => {
    responders["conversations.replies"] = () => ({
      messages: [message(["F1", "F2", "F3"])],
      ok: true,
    });
    await handleApi(
      multipart("PATCH", "/channels/C1/messages/5.5", { fileIds: ["F3", "F1"], text: "x" }, [
        "new.png",
      ]),
      who,
    );
    expect(paramsOf("chat.update").file_ids).toBe("F3,F1,N1");
    expect(called("files.delete").map((call) => call.params.file)).toEqual(["F2"]);
  });

  test("removes every file when asked to keep none", async () => {
    responders["conversations.replies"] = () => ({ messages: [message(["F1"])], ok: true });
    await handleApi(json("PATCH", "/channels/C1/messages/5.5", { fileIds: [], text: "x" }), who);
    expect(paramsOf("chat.update").file_ids).toBe("");
  });

  test("leaves files alone when the list is unchanged", async () => {
    responders["conversations.replies"] = () => ({ messages: [message(["F1", "F2"])], ok: true });
    await handleApi(
      json("PATCH", "/channels/C1/messages/5.5", { fileIds: ["F1", "F2"], text: "x" }),
      who,
    );
    expect(paramsOf("chat.update")).not.toHaveProperty("file_ids");
  });

  test("discards new files if the edit fails", async () => {
    responders["chat.update"] = () => ({ error: "cant_update_message", ok: false });
    await handleApi(
      multipart("PATCH", "/channels/C1/messages/5.5", { text: "x" }, ["new.png"]),
      who,
    );
    expect(called("files.delete").map((call) => call.params.file)).toEqual(["N1"]);
  });

  test("cannot keep files that are not on the message", async () => {
    const res = await handleApi(
      json("PATCH", "/channels/C1/messages/5.5", { fileIds: ["F9"], text: "x" }),
      who,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_file_ids", ok: false });
    expect(called("chat.update")).toEqual([]);
  });

  test("broadcasts a reply while keeping its content", async () => {
    await handleApi(json("PATCH", "/channels/C1/messages/5.5", { replyBroadcast: true }), who);
    expect(paramsOf("chat.update")).toEqual({
      blocks: '[{"type":"divider"}]',
      channel: "C1",
      reply_broadcast: "true",
      text: "old",
      ts: "5.5",
    });
  });
});

describe("deleting", () => {
  test("deletes the message and its files", async () => {
    responders["conversations.replies"] = () => ({ messages: [message(["F1", "F2"])], ok: true });
    const res = await handleApi(json("DELETE", "/channels/C1/messages/5.5"), who);
    expect(await res.json()).toEqual({ ok: true, ts: "5.5" });
    expect(paramsOf("chat.delete")).toEqual({ channel: "C1", ts: "5.5" });
    expect(called("files.delete").map((call) => call.params.file)).toEqual(["F1", "F2"]);
  });

  test("only deletes messages the user relayed", async () => {
    responders["conversations.replies"] = () => ({ messages: [], ok: true });
    const res = await handleApi(json("DELETE", "/channels/C1/messages/5.5"), who);
    expect(res.status).toBe(403);
    expect(called("chat.delete")).toEqual([]);
  });
});
