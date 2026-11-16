import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { Credentials } from "../../../src/slack/server/api/auth";
import {
  readRelayBody,
  relayBroadcast,
  relayDelete,
  relayEdit,
} from "../../../src/slack/server/api/relayMessages";
import type { RouteCtx } from "../../../src/slack/server/api/router";

type Seen = { url: string; method: string; headers: Headers; body: unknown };

const base: Credentials = {
  domain: "w.slack.com",
  route: "T1",
  slackSession: "xoxd-1",
  token: "xoxc-1",
};
let seen: Seen[];
let reply: (seen: Seen) => Response;

function context(creds: Credentials | null, contentType: string | null = null): RouteCtx {
  const unavailable = () => Promise.reject(new Error("unused"));
  return {
    acceptEncoding: null,
    body: { buffer: unavailable, formData: unavailable, json: unavailable },
    contentType,
    cookie: null,
    creds,
    params: {},
    range: null,
    searchParams: new URLSearchParams(),
  };
}

beforeEach(() => {
  seen = [];
  reply = () => Response.json({ ok: true, ts: "9.9" });
  Bun.env.SLOCK_RELAY_URL = "https://relay.test/";
  spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      (input: URL | RequestInfo, init?: RequestInit) => {
        const entry = {
          body: init?.body,
          headers: new Headers(init?.headers),
          method: init?.method ?? "GET",
          url: String(input),
        };
        seen.push(entry);
        return Promise.resolve(reply(entry));
      },
      { preconnect: () => {} },
    ),
  );
});

afterEach(() => {
  mock.restore();
  Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
});

const withToken = { ...base, relayToken: "slockrelay_abc.def" };
const slashCalls = () => seen.filter((call) => call.url.includes("/api/chat.command"));
const relayCalls = () => seen.filter((call) => call.url.startsWith("https://relay.test"));

describe("relay over the token api", () => {
  test("posts json and returns the timestamp", async () => {
    const res = await relayBroadcast(context(withToken), "C1", {
      text: "<!channel> hi",
      unfurl: [],
    });
    expect(await res.json()).toEqual({ ts: "9.9" });
    const [call] = relayCalls();
    expect(call?.url).toBe("https://relay.test/channels/C1/messages");
    expect(call?.method).toBe("POST");
    expect(call?.headers.get("authorization")).toBe("Bearer slockrelay_abc.def");
    expect(call?.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(call?.body))).toEqual({
      action: "post",
      text: "<!channel> hi",
      unfurl: [],
    });
    expect(slashCalls()).toEqual([]);
  });

  test("sends files as multipart with the json in a payload field", async () => {
    const files = [new File(["a"], "a.png"), new File(["b"], "b.txt")];
    await relayBroadcast(context(withToken), "C1", { text: "pics" }, files);
    const [call] = relayCalls();
    expect(call?.headers.has("content-type")).toBe(false);
    const form = call?.body;
    expect(form).toBeInstanceOf(FormData);
    if (!(form instanceof FormData)) return;
    expect(JSON.parse(String(form.get("payload")))).toEqual({ action: "post", text: "pics" });
    expect(form.getAll("files").map((part) => (part instanceof File ? part.name : part))).toEqual([
      "a.png",
      "b.txt",
    ]);
  });

  test("edits and deletes address the message", async () => {
    await relayEdit(context(withToken), "C1", "1.5", { fileIds: ["F1"], text: "new" });
    await relayDelete(context(withToken), "C1", "1.5");
    expect(relayCalls().map((call) => [call.method, call.url])).toEqual([
      ["PATCH", "https://relay.test/channels/C1/messages/1.5"],
      ["DELETE", "https://relay.test/channels/C1/messages/1.5"],
    ]);
    expect(JSON.parse(String(relayCalls()[0]?.body))).toEqual({
      action: "edit",
      fileIds: ["F1"],
      text: "new",
      ts: "1.5",
    });
  });

  test("passes relay errors back to the client", async () => {
    reply = () => Response.json({ error: "not_a_channel_manager", ok: false }, { status: 403 });
    const res = await relayBroadcast(context(withToken), "C1", { text: "x" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "not_a_channel_manager" });
  });

  test("reports an unreachable relay", async () => {
    reply = () => {
      throw new Error("connect refused");
    };
    const res = await relayBroadcast(context(withToken), "C1", { text: "x" });
    expect(await res.json()).toEqual({ error: "connect refused" });
  });
});

describe("relay over the slash command", () => {
  test("is used when the account has no token", async () => {
    const res = await relayBroadcast(context(base), "C1", { text: "hi" });
    expect(res.status).toBe(200);
    expect(relayCalls()).toEqual([]);
    const [call] = slashCalls();
    const form = String(call?.body);
    expect(new URLSearchParams(form).get("command")).toBe("/slock-relay");
    expect(JSON.parse(new URLSearchParams(form).get("text") ?? "")).toEqual({
      action: "post",
      text: "hi",
    });
  });

  test("is used when no relay is configured", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    await relayDelete(context(withToken), "C1", "1.5");
    expect(relayCalls()).toEqual([]);
    expect(slashCalls()).toHaveLength(1);
  });

  test("takes over when the token has expired, for messages without files", async () => {
    reply = (call) =>
      call.url.startsWith("https://relay.test")
        ? Response.json({ error: "invalid_token", ok: false }, { status: 401 })
        : Response.json({ ok: true });
    const res = await relayBroadcast(context(withToken), "C1", { text: "hi" });
    expect(res.status).toBe(200);
    expect(slashCalls()).toHaveLength(1);
  });
});

describe("relay files", () => {
  const files = [new File(["a"], "a.png")];

  test("need a token", async () => {
    const res = await relayBroadcast(context(base), "C1", { text: "hi" }, files);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "relay_token_required" });
    expect(seen).toEqual([]);
  });

  test("are not retried over the slash command when the token expired", async () => {
    reply = () => Response.json({ error: "invalid_token", ok: false }, { status: 401 });
    const res = await relayBroadcast(context(withToken), "C1", { text: "hi" }, files);
    expect(await res.json()).toEqual({ error: "invalid_token" });
    expect(slashCalls()).toEqual([]);
  });
});

test("requests need credentials", async () => {
  const res = await relayBroadcast(context(null), "C1", { text: "hi" });
  expect(res.status).toBe(401);
});

describe("readRelayBody", () => {
  test("reads json bodies", async () => {
    const ctx = context(base, "application/json");
    ctx.body.json = () => Promise.resolve(JSON.parse('{"text":"hi"}'));
    expect(await readRelayBody(ctx)).toEqual({ fields: { text: "hi" }, files: [] });
  });

  test("reads the payload and files of multipart bodies", async () => {
    const form = new FormData();
    form.append("payload", JSON.stringify({ text: "pics" }));
    form.append("files", new File(["a"], "a.png"));
    const ctx = context(base, "multipart/form-data; boundary=x");
    ctx.body.formData = () => new Response(form).formData();
    const { fields, files } = await readRelayBody(ctx);
    expect(fields).toEqual({ text: "pics" });
    expect(files.map((file) => file.name)).toEqual(["a.png"]);
  });
});
