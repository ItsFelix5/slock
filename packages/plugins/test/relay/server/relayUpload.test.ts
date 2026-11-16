import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { Credentials } from "../../../src/slack/server/api/auth";
import { relayUpload } from "../../../src/slack/server/api/relayMessages";
import type { RouteCtx } from "../../../src/slack/server/api/router";

const creds: Credentials = {
  domain: "w.slack.com",
  route: "T1",
  slackSession: "xoxd-1",
  token: "xoxc-1",
};

type Seen = { url: string; method?: string; body: unknown };
let seen: Seen[];
let reply: () => Response;

function context(account: Credentials | null): RouteCtx {
  const unused = () => Promise.reject(new Error("unused"));
  return {
    acceptEncoding: null,
    body: { buffer: unused, json: unused },
    cookie: null,
    creds: account,
    params: {},
    range: null,
    searchParams: new URLSearchParams(),
  };
}

beforeEach(() => {
  seen = [];
  reply = () => new Response(null);
  Bun.env.SLOCK_RELAY_URL = "https://relay.test/";
  spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      (input: URL | RequestInfo, init?: RequestInit) => {
        seen.push({ body: init?.body, method: init?.method, url: String(input) });
        return Promise.resolve(reply());
      },
      { preconnect: () => {} },
    ),
  );
});

afterEach(() => {
  mock.restore();
  Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
});

describe("relayUpload", () => {
  test("hands the file to the relay under its upload id", async () => {
    const res = await relayUpload(
      context(creds),
      "up-0123456789abcdef",
      "my pic.png",
      new Uint8Array([1, 2, 3]),
    );
    expect(res.status).toBe(200);
    const [call] = seen;
    expect(call?.method).toBe("POST");
    const url = new URL(call?.url ?? "");
    expect(url.origin + url.pathname).toBe("https://relay.test/files");
    expect(url.searchParams.get("uploadId")).toBe("up-0123456789abcdef");
    expect(url.searchParams.get("filename")).toBe("my pic.png");
    expect(call?.body).toBeInstanceOf(Blob);
    expect(await (call?.body as Blob).bytes()).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("needs a signed-in user", async () => {
    expect((await relayUpload(context(null), "id", "a", new Uint8Array())).status).toBe(401);
    expect(seen).toEqual([]);
  });

  test("explains when the server has no relay", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    const res = await relayUpload(context(creds), "id", "a", new Uint8Array());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("isn't set up to send files");
  });

  test("reports a relay that refuses or cannot be reached", async () => {
    reply = () => new Response(null, { status: 400 });
    expect((await relayUpload(context(creds), "id", "a", new Uint8Array())).status).toBe(502);
    reply = () => {
      throw new Error("refused");
    };
    expect((await relayUpload(context(creds), "id", "a", new Uint8Array())).status).toBe(502);
  });
});
