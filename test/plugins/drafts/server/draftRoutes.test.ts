import { afterEach, expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import setup from "../../../../packages/plugins/src/drafts/server";
import { createFakeEnv } from "../../../support/core";

const errors = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  errors.mockRestore();
});

test("a rejected save keeps the message text out of the server log", async () => {
  const env = createFakeEnv();
  env.fetch.respond(/drafts.create/, () => Response.json({ error: "invalid_blocks", ok: false }));
  const host = createHost({ env });
  setHost(host);
  await host.register(
    { id: "slack", setup: (ctx) => ctx.provide("slack.inFlight", { pending: new Map() }) },
    { id: "drafts", setup },
  );
  const url = new URL("http://slock.test/api/drafts");
  const body = { blocks: [{ text: "secret" }], channelId: "C1", clientMsgId: "m" };
  const [handle] = host.items("http");
  const res = await handle?.(
    {
      creds: { domain: "a.slack.com", route: "T1", slackSession: "s", token: "t" },
      req: new Request(url, { body: JSON.stringify(body), method: "PUT" }),
      upgrade: () => false,
      url,
    },
    () => Promise.resolve(new Response(null, { status: 404 })),
  );
  expect(res?.ok).toBe(false);
  expect(errors).toHaveBeenCalled();
  expect(JSON.stringify(errors.mock.calls)).not.toContain("secret");
  await host.stop();
});
