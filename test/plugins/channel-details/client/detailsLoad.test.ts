import { expect, test } from "bun:test";
import { createFakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch } from "../../../support/slack";

const CHANNEL = ch("C1");

test("a refused details load is an error, and a retry loads them", async () => {
  const env = createFakeEnv(1, 1_000_000);
  env.fetch.respond(
    /\/view$/,
    () => new Response(JSON.stringify({ error: "no_permission" }), { status: 400 }),
  );
  const host = await startQueryHost(env);
  const { conversationView } = await import(
    "../../../../packages/plugins/src/slack/client/api/conversationView"
  );
  await expect(conversationView.ensure(CHANNEL)).rejects.toThrow();
  expect(conversationView.read(CHANNEL)).toBeUndefined();
  env.fetch.respond(/\/view$/, () => new Response("{}"));
  await conversationView.refresh(CHANNEL);
  expect(conversationView.read(CHANNEL)?.details.id).toBe(CHANNEL);
  host.stop();
});
