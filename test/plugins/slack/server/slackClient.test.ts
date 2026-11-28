import { beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import type { Credentials } from "../../../../packages/plugins/src/slack/server/api/auth";
import { callSlack } from "../../../../packages/plugins/src/slack/server/api/slackClient";
import { createFakeEnv, type FakeEnv } from "../../../support/core";

const session = (token: string, slackSession = "d1"): Credentials => ({
  domain: "example.slack.com",
  route: "T1",
  slackSession,
  token,
});
let env: FakeEnv;

beforeEach(async () => {
  env = createFakeEnv();
  const host = createHost({ env });
  setHost(host);
  await host.register({
    id: "slack",
    setup: (ctx) => ctx.provide("slack.inFlight", { pending: new Map() }),
  });
  env.fetch.hold(/api\/users\.info/);
});

const settleAll = (user: string) => {
  for (const call of env.fetch.pending()) call.resolve(Response.json({ ok: true, user }));
};

describe("callSlack read dedupe", () => {
  test("one session issuing the same read twice shares one request", async () => {
    const first = callSlack("users.info", { user: "U1" }, session("xoxc-a"));
    const second = callSlack("users.info", { user: "U1" }, session("xoxc-a"));
    expect(env.fetch.pending()).toHaveLength(1);
    settleAll("mine");
    expect(await first).toEqual(await second);
  });

  test("two sessions issuing the same read never share a response", async () => {
    const alice = callSlack("users.info", { user: "U1" }, session("xoxc-a"));
    const bob = callSlack("users.info", { user: "U1" }, session("xoxc-b"));
    const [one, two] = env.fetch.pending();
    expect(env.fetch.pending()).toHaveLength(2);
    two?.resolve(Response.json({ ok: true, user: "bob" }));
    one?.resolve(Response.json({ ok: true, user: "alice" }));
    expect(await alice).toMatchObject({ user: "alice" });
    expect(await bob).toMatchObject({ user: "bob" });
  });

  test("the same token with another cookie is another session", async () => {
    const first = callSlack("users.info", { user: "U1" }, session("xoxc-a", "d1"));
    const second = callSlack("users.info", { user: "U1" }, session("xoxc-a", "d2"));
    expect(env.fetch.pending()).toHaveLength(2);
    settleAll("x");
    await Promise.all([first, second]);
  });

  test("a finished read is fetched again", async () => {
    const first = callSlack("users.info", { user: "U1" }, session("xoxc-a"));
    settleAll("x");
    await first;
    const second = callSlack("users.info", { user: "U1" }, session("xoxc-a"));
    expect(env.fetch.pending().filter((call) => !call.settled)).toHaveLength(1);
    settleAll("x");
    await second;
  });
});
