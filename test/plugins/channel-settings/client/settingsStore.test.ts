import { expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import { createRoot, flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch } from "../../../support/slack";

const CHANNEL = ch("C1");

async function start() {
  const env = createFakeEnv(1, 1_000_000);
  const failures: string[] = [];
  env.fetch.respond(/\/posting-prefs$/, () => new Response(JSON.stringify({ prefs: {} })));
  env.fetch.respond(
    /\/member-permissions$/,
    () => new Response(JSON.stringify({ invite: true, setPurpose: true, setTopic: true })),
  );
  const host = await startQueryHost(env);
  await host.register({
    id: "feedback",
    setup: (ctx) =>
      ctx.provide(
        "feedback",
        partialService<Services["feedback"]>({
          caught: (_key, _error, message) => void failures.push(message),
        }),
      ),
  });
  const store = await import("../../../../packages/plugins/src/channel-settings/client/store");
  return { env, failures, store };
}

test("a posting change shows at once and is undone when Slack refuses it", async () => {
  const { env, store } = await start();
  const prefs = createRoot(() => store.postingPrefs.state(() => CHANNEL));
  await store.postingPrefs.ensure(CHANNEL);
  flush();
  env.fetch.hold(/\/posting-prefs$/);
  const errors: unknown[] = [];
  const saving = store.savingPosting.run({
    channelId: CHANNEL,
    onFailure: (error) => errors.push(error),
    patch: { threadsRestrictedToManagers: true },
  });
  flush();
  expect(prefs().data?.threadsRestrictedToManagers).toBe(true);
  env.fetch.pending()[0]?.resolve(new Response("{}", { status: 400 }));
  expect(await saving).toBe(false);
  flush();
  expect(prefs().data?.threadsRestrictedToManagers).toBe(false);
  expect(errors).toHaveLength(1);
});

test("saved permissions replace only the changed policies", async () => {
  const { env, store } = await start();
  await store.memberPermissions.ensure(CHANNEL);
  env.fetch.respond(/\/member-permissions$/, new Response("{}"));
  await store.savingPermissions.run({ channelId: CHANNEL, patch: { setTopic: false } });
  expect(store.memberPermissions.read(CHANNEL)).toEqual({
    invite: true,
    setPurpose: true,
    setTopic: false,
  });
});

test("a refused retention change keeps the old policy and reports it", async () => {
  const { env, failures, store } = await start();
  store.retention.set(CHANNEL, 30);
  env.fetch.respond(/\/retention$/, new Response("{}", { status: 400 }));
  expect(await store.savingRetention.run({ channelId: CHANNEL, days: null })).toBe(false);
  expect(store.retention.read(CHANNEL)).toBe(30);
  expect(failures).toEqual(["Failed to update message retention."]);
});

test("saved posting and retention values are what a reopened tab reads", async () => {
  const { env, store } = await start();
  await store.postingPrefs.ensure(CHANNEL);
  store.retention.set(CHANNEL, 30);
  env.fetch.respond(/\/(posting-prefs|retention)$/, () => new Response("{}"));
  await store.savingPosting.run({
    channelId: CHANNEL,
    onFailure: () => {},
    patch: { threadsRestrictedToManagers: true },
  });
  await store.savingRetention.run({ channelId: CHANNEL, days: 7 });
  expect(store.postingPrefs.read(CHANNEL)?.threadsRestrictedToManagers).toBe(true);
  expect(store.retention.read(CHANNEL)).toBe(7);
});
