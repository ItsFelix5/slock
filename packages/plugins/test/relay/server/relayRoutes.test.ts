import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createHost, runHttp } from "@slock/core";
import setup from "../../../src/relay/server/index";
import type { Credentials } from "../../../src/slack/server/api/auth";
import { connectAccount } from "../../../src/slack/server/api/session";

const creds: Credentials = {
  domain: "team.slack.com",
  route: "T1",
  slackSession: "xoxd-1",
  token: "xoxc-1",
};
const TOKEN = "slockrelay_abc.def";

let relayReply: Response;
let relayAuth: (string | null)[];
let relayPaths: string[];

beforeEach(() => {
  relayReply = Response.json({ ok: true, team: "T1", user: "U1" });
  relayAuth = [];
  relayPaths = [];
  Bun.env.SLOCK_RELAY_URL = "https://relay.test";
  spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      (input: URL | RequestInfo, init?: RequestInit) => {
        const url = String(input);
        if (!url.startsWith("https://relay.test")) {
          return Promise.resolve(Response.json({ ok: true, profile: { display_name: "felix" } }));
        }
        relayPaths.push(new URL(url).pathname);
        relayAuth.push(new Headers(init?.headers).get("authorization"));
        return Promise.resolve(relayReply.clone());
      },
      { preconnect: () => {} },
    ),
  );
});

afterEach(() => {
  mock.restore();
  Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
});

function cookieFor(account: Credentials) {
  const info = {
    accounts: [{ domain: account.domain, id: "a1", name: "n", teamId: "T1" }],
    id: "a1",
  };
  const stored = encodeURIComponent(JSON.stringify({ ...account, id: "a1" }));
  return `slock_acct_a1=${stored}; slock_info=${encodeURIComponent(JSON.stringify(info))}`;
}

async function request(method: string, path: string, body?: object, account = creds) {
  const host = createHost();
  await host.register({ id: "relay", setup });
  const url = new URL(`http://localhost${path}`);
  const req = new Request(url, {
    body: body && JSON.stringify(body),
    headers: { cookie: cookieFor(account) },
    method,
  });
  const res = await runHttp(host.items("http"), { creds: account, req, upgrade: () => false, url });
  return { json: await res?.json(), res, status: res?.status };
}

function storedAccount(res: Response | undefined) {
  const line = res?.headers.getSetCookie().find((cookie) => cookie.startsWith("slock_acct_a1="));
  const value = line?.slice("slock_acct_a1=".length).split(";")[0] ?? "";
  return value ? JSON.parse(decodeURIComponent(value)) : undefined;
}

describe("GET /api/relay", () => {
  test("says whether a relay exists and whether the account is connected", async () => {
    expect((await request("GET", "/api/relay")).json).toEqual({
      available: true,
      connected: false,
    });
    expect(
      (await request("GET", "/api/relay", undefined, { ...creds, relayToken: TOKEN })).json,
    ).toEqual({
      available: true,
      connected: true,
    });
  });

  test("reports when the server has no relay", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    expect((await request("GET", "/api/relay")).json).toEqual({
      available: false,
      connected: false,
    });
  });
});

describe("PUT /api/relay/token", () => {
  test("checks the token with the relay and stores it in the account cookie", async () => {
    const { res, status } = await request("PUT", "/api/relay/token", { token: ` ${TOKEN} ` });
    expect(status).toBe(200);
    expect(relayPaths).toEqual(["/me"]);
    expect(relayAuth).toEqual([`Bearer ${TOKEN}`]);
    expect(storedAccount(res)).toMatchObject({ id: "a1", relayToken: TOKEN, token: "xoxc-1" });
  });

  test("refuses a token the relay rejects", async () => {
    relayReply = Response.json({ error: "invalid_token", ok: false }, { status: 401 });
    const { json, res, status } = await request("PUT", "/api/relay/token", { token: TOKEN });
    expect(status).toBe(400);
    expect(json).toEqual({ error: "invalid_token" });
    expect(res?.headers.getSetCookie()).toEqual([]);
  });

  test("refuses things that are not tokens without asking the relay", async () => {
    for (const token of ["", "has space", "x\ny", "a".repeat(3000)]) {
      const { status } = await request("PUT", "/api/relay/token", { token });
      expect(status).toBe(400);
    }
    expect(relayPaths).toEqual([]);
  });

  test("needs a relay to check against", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    const { json, status } = await request("PUT", "/api/relay/token", { token: TOKEN });
    expect(status).toBe(400);
    expect(json).toEqual({ error: "relay_not_configured" });
  });

  test("surfaces an unreachable relay", async () => {
    relayReply = Response.json({ error: "relay down", ok: false }, { status: 500 });
    expect((await request("PUT", "/api/relay/token", { token: TOKEN })).status).toBe(502);
  });
});

describe("DELETE /api/relay/token", () => {
  test("removes the token from the account cookie", async () => {
    const { res } = await request("DELETE", "/api/relay/token", undefined, {
      ...creds,
      relayToken: TOKEN,
    });
    const account = storedAccount(res);
    expect(account).toMatchObject({ id: "a1", token: "xoxc-1" });
    expect(account).not.toHaveProperty("relayToken");
  });
});

describe("reconnecting an account", () => {
  test("keeps its relay token", async () => {
    const res = await connectAccount(cookieFor({ ...creds, relayToken: TOKEN }), creds);
    expect(storedAccount(res)).toMatchObject({ id: "a1", relayToken: TOKEN });
  });
});
