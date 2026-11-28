import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import { createEmojiCache } from "../../../../packages/plugins/src/emoji/server/cache";
import { createFakeEnv, type FakeEnv } from "../../../support/core";

const creds = { domain: "a.slack.com", route: "E1:T1", slackSession: "s", token: "t" };
const list = (...names: string[]) =>
  Response.json({
    emoji: Object.fromEntries(names.map((name) => [name, `https://img/${name}`])),
    ok: true,
  });

let env: FakeEnv;
let host: ReturnType<typeof createHost>;

beforeEach(() => {
  env = createFakeEnv();
  host = createHost({ env });
  setHost(host);
});

afterEach(async () => {
  await host.stop();
});

describe("emoji cache", () => {
  test("a failed list is not remembered", async () => {
    const cache = createEmojiCache();
    env.fetch.respond(/emoji.list/, () => Response.json({ error: "ratelimited", ok: false }));
    await expect(cache.list(creds)).rejects.toThrow("ratelimited");
    env.fetch.respond(/emoji.list/, () => list("party"));
    expect((await cache.list(creds)).names).toEqual(["party"]);
  });

  test("a change during a load is not overwritten by the older list", async () => {
    const cache = createEmojiCache();
    env.fetch.hold(/emoji.list/);
    const stale = cache.list(creds);
    cache.invalidate(creds);
    env.fetch.pending()[0]?.resolve(list("old"));
    await stale;
    env.fetch.respond(/emoji.list/, () => list("new"));
    expect((await cache.list(creds)).names).toEqual(["new"]);
  });
});
