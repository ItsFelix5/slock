import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import { commentRoutes } from "../../../../packages/plugins/src/canvas/server/comments";
import { createCanvasWire } from "../../../../packages/plugins/src/canvas/server/wire";
import { routes } from "../../../../packages/plugins/src/slack/server/api/router";
import { createFakeEnv } from "../../../support/core";

const creds = { domain: "a.slack.com", route: "T1", slackSession: "s", token: "t" };

let env: ReturnType<typeof createFakeEnv>;
let host: ReturnType<typeof createHost>;

beforeEach(async () => {
  env = createFakeEnv();
  host = createHost({ env });
  setHost(host);
  await host.register({
    id: "slack",
    setup: (ctx) => ctx.provide("slack.inFlight", { pending: new Map() }),
  });
});

afterEach(async () => {
  await host.stop();
});

function sync(error: string) {
  env.fetch.respond(/quip.thread.synchronize/, () => Response.json({ error, ok: false }));
  const url = new URL("http://slock.test/api/canvases/F1/comments/sync");
  const body = JSON.stringify({ ts: "1700000000.000100" });
  const handle = routes(commentRoutes(createCanvasWire(env)));
  return handle(
    { creds, req: new Request(url, { body, method: "POST" }), upgrade: () => false, url },
    () => Promise.resolve(new Response(null, { status: 404 })),
  );
}

test("a Grid refusal to sync does not fail the posted reply", async () => {
  expect((await sync("team_is_restricted"))?.status).toBe(200);
});

test("other sync failures are reported", async () => {
  expect((await sync("thread_not_found"))?.status).toBe(502);
});
