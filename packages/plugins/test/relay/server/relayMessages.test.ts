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

const creds: Credentials = {
  domain: "w.slack.com",
  route: "T1",
  slackSession: "xoxd-1",
  token: "xoxc-1",
};
let seen: Seen[];
let reply: (seen: Seen) => Response;

function respond(call: Seen) {
  if (call.url.endsWith("/token")) return Response.json({ ok: true, token: "minted-token" });
  if (call.url.startsWith("https://relay.test")) return Response.json({ ok: true, ts: "9.9" });
  return Response.json({ ok: true });
}

function context(account: Credentials | null, contentType: string | null = null): RouteCtx {
  const unavailable = () => Promise.reject(new Error("unused"));
  return {
    acceptEncoding: null,
    body: { buffer: unavailable, formData: unavailable, json: unavailable },
    contentType,
    cookie: null,
    creds: account,
    params: {},
    range: null,
    searchParams: new URLSearchParams(),
  };
}

beforeEach(() => {
  seen = [];
  reply = respond;
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

const slashCalls = () => seen.filter((call) => call.url.includes("/api/chat.command"));
const relayCalls = () => seen.filter((call) => call.url.startsWith("https://relay.test"));
const slashText = (call?: Seen) =>
  JSON.parse(new URLSearchParams(String(call?.body)).get("text") ?? "");
const files = () => [new File(["a"], "a.png"), new File(["b"], "b.txt")];

describe("messages without files", () => {
  test("go through the slash command, with no relay needed", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    const res = await relayBroadcast(context(creds), "C1", { text: "<!channel> hi" });
    expect(res.status).toBe(200);
    expect(relayCalls()).toEqual([]);
    const [call] = slashCalls();
    expect(new URLSearchParams(String(call?.body)).get("command")).toBe("/slock-relay");
    expect(slashText(call)).toEqual({ action: "post", text: "<!channel> hi" });
  });

  test("edits and deletes use it too", async () => {
    await relayEdit(context(creds), "C1", "1.5", { fileIds: ["F1"], text: "new" });
    await relayDelete(context(creds), "C1", "1.5");
    expect(slashCalls().map((call) => slashText(call))).toEqual([
      { action: "edit", fileIds: ["F1"], text: "new", ts: "1.5" },
      { action: "delete", ts: "1.5" },
    ]);
    expect(relayCalls()).toEqual([]);
  });

  test("report the slash command failing", async () => {
    reply = () => Response.json({ error: "dispatch_failed", ok: false });
    const res = await relayBroadcast(context(creds), "C1", { text: "hi" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "dispatch_failed" });
  });
});

describe("messages with files", () => {
  test("ask the relay for a token through the slash command, then send with it", async () => {
    const res = await relayBroadcast(context(creds), "C1", { text: "pics" }, files());
    expect(await res.json()).toEqual({ ts: "9.9" });

    const [ask] = slashCalls();
    const { action, nonce } = slashText(ask);
    expect(action).toBe("token");
    expect(typeof nonce).toBe("string");

    const [redeem, send] = relayCalls();
    expect([redeem?.method, redeem?.url]).toEqual(["POST", "https://relay.test/token"]);
    expect(JSON.parse(String(redeem?.body))).toEqual({ nonce });

    expect([send?.method, send?.url]).toEqual(["POST", "https://relay.test/channels/C1/messages"]);
    expect(send?.headers.get("authorization")).toBe("Bearer minted-token");
    expect(send?.headers.has("content-type")).toBe(false);
    const form = send?.body;
    if (!(form instanceof FormData)) throw new Error("expected multipart");
    expect(JSON.parse(String(form.get("payload")))).toEqual({ action: "post", text: "pics" });
    expect(form.getAll("files").map((part) => (part instanceof File ? part.name : part))).toEqual([
      "a.png",
      "b.txt",
    ]);
  });

  test("never send a stored token or the user's own credentials to the relay", async () => {
    await relayBroadcast(context(creds), "C1", { text: "pics" }, files());
    for (const call of relayCalls()) {
      expect(String(call.headers.get("cookie"))).not.toContain("xoxd");
      expect(String(call.body)).not.toContain("xoxc");
    }
  });

  test("edits send their new files with a PATCH", async () => {
    await relayEdit(context(creds), "C1", "1.5", { fileIds: ["F1"], text: "new" }, files());
    const [, send] = relayCalls();
    expect([send?.method, send?.url]).toEqual([
      "PATCH",
      "https://relay.test/channels/C1/messages/1.5",
    ]);
    const form = send?.body;
    if (!(form instanceof FormData)) throw new Error("expected multipart");
    expect(JSON.parse(String(form.get("payload")))).toEqual({
      action: "edit",
      fileIds: ["F1"],
      text: "new",
      ts: "1.5",
    });
  });

  test("need a relay", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    const res = await relayBroadcast(context(creds), "C1", { text: "hi" }, files());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "relay_not_configured" });
    expect(seen).toEqual([]);
  });

  test("stop if the slash command fails", async () => {
    reply = (call) =>
      call.url.includes("/api/chat.command")
        ? Response.json({ error: "dispatch_failed", ok: false })
        : Response.json({ ok: true });
    const res = await relayBroadcast(context(creds), "C1", { text: "hi" }, files());
    expect(await res.json()).toEqual({ error: "dispatch_failed" });
    expect(relayCalls()).toEqual([]);
  });

  test("stop if the relay never received who asked", async () => {
    reply = (call) =>
      call.url.endsWith("/token")
        ? Response.json({ error: "token_not_found", ok: false }, { status: 404 })
        : Response.json({ ok: true });
    const res = await relayBroadcast(context(creds), "C1", { text: "hi" }, files());
    expect(await res.json()).toEqual({ error: "token_not_found" });
    expect(relayCalls()).toHaveLength(1);
  });

  test("pass the relay's errors back to the client", async () => {
    reply = (call) =>
      call.url.endsWith("/channels/C1/messages")
        ? Response.json({ error: "not_a_channel_manager", ok: false }, { status: 403 })
        : respond(call);
    const res = await relayBroadcast(context(creds), "C1", { text: "x" }, files());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "not_a_channel_manager" });
  });

  test("report an unreachable relay", async () => {
    reply = (call) => {
      if (call.url.startsWith("https://relay.test")) throw new Error("connect refused");
      return Response.json({ ok: true });
    };
    const res = await relayBroadcast(context(creds), "C1", { text: "x" }, files());
    expect(await res.json()).toEqual({ error: "connect refused" });
  });
});

test("requests need credentials", async () => {
  const res = await relayBroadcast(context(null), "C1", { text: "hi" });
  expect(res.status).toBe(401);
});

describe("readRelayBody", () => {
  test("reads json bodies", async () => {
    const ctx = context(creds, "application/json");
    ctx.body.json = () => Promise.resolve(JSON.parse('{"text":"hi"}'));
    expect(await readRelayBody(ctx)).toEqual({ fields: { text: "hi" }, files: [] });
  });

  test("reads the payload and files of multipart bodies", async () => {
    const form = new FormData();
    form.append("payload", JSON.stringify({ text: "pics" }));
    form.append("files", new File(["a"], "a.png"));
    const ctx = context(creds, "multipart/form-data; boundary=x");
    ctx.body.formData = () => new Response(form).formData();
    const { fields, files } = await readRelayBody(ctx);
    expect(fields).toEqual({ text: "pics" });
    expect(files.map((file) => file.name)).toEqual(["a.png"]);
  });
});
