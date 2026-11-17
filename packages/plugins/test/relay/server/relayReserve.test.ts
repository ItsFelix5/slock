import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { Credentials } from "../../../src/slack/server/api/auth";
import { relayReserve } from "../../../src/slack/server/api/relayMessages";
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

describe("relayReserve", () => {
  test("asks the relay for a reservation for this account's workspace", async () => {
    reply = () =>
      Response.json({ file_id: "R1", ok: true, upload_url: "https://files.slack.com/u" });
    const res = await relayReserve(context(creds), "my pic.png", "3");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ file_id: "R1", upload_url: "https://files.slack.com/u" });
    const [call] = seen;
    expect([call?.method, call?.url]).toEqual(["POST", "https://relay.test/reserve"]);
    expect(JSON.parse(String(call?.body))).toEqual({
      filename: "my pic.png",
      length: "3",
      team: "T1",
    });
  });

  test("uses the workspace id of an enterprise route", async () => {
    reply = () => Response.json({ file_id: "R1", ok: true, upload_url: "u" });
    await relayReserve(context({ ...creds, route: "E1:T9" }), "a", "1");
    expect(JSON.parse(String(seen[0]?.body)).team).toBe("T9");
  });

  test("needs a signed-in user", async () => {
    expect((await relayReserve(context(null), "a", "1")).status).toBe(401);
    expect(seen).toEqual([]);
  });

  test("explains when the server has no relay", async () => {
    Reflect.deleteProperty(Bun.env, "SLOCK_RELAY_URL");
    const res = await relayReserve(context(creds), "a", "1");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("isn't set up to send files");
  });

  test("passes on a refusal and an unreachable relay", async () => {
    reply = () => Response.json({ error: "missing_scope", ok: false }, { status: 502 });
    const refused = await relayReserve(context(creds), "a", "1");
    expect([refused.status, (await refused.json()).error]).toEqual([502, "missing_scope"]);
    reply = () => {
      throw new Error("refused");
    };
    expect((await relayReserve(context(creds), "a", "1")).status).toBe(502);
  });
});
