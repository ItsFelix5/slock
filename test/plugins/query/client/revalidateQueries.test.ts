import { afterEach, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { defineQuery } from "../../../../packages/plugins/src/query/client/api";
import { createFakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { installFakeBrowser } from "../../realtime/support/fakeBrowser";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

async function start() {
  const env = createFakeEnv();
  const browser = installFakeBrowser({ online: true });
  Object.assign(document, { cookie: "" });
  cleanups.push(browser.restore);
  const host = await startQueryHost(env);
  let loads = 0;
  const item = defineQuery<string, number>({ load: () => Promise.resolve(++loads), name: "item" });
  return { browser, env, host, item, loads: () => loads };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

function mount(item: ReturnType<typeof defineQuery<string, number>>) {
  const dispose = createRoot((stop) => {
    item.state(() => "a");
    return stop;
  });
  cleanups.push(dispose);
  return dispose;
}

test("online refetches active queries once and respects the throttle", async () => {
  const t = await start();
  mount(t.item);
  await settle();
  expect(t.loads()).toBe(1);
  t.browser.goOnline();
  await settle();
  expect(t.loads()).toBe(2);
  t.env.advance(1_000);
  t.browser.goOnline();
  await settle();
  expect(t.loads()).toBe(2);
  t.env.advance(5_000);
  t.browser.goOnline();
  await settle();
  expect(t.loads()).toBe(3);
});

test("unmounted queries are not refetched", async () => {
  const t = await start();
  await t.item.ensure("a");
  t.browser.goOnline();
  await settle();
  expect(t.loads()).toBe(1);
});

test("realtime reconnect revalidates even right after another trigger", async () => {
  const t = await start();
  mount(t.item);
  await settle();
  t.browser.goOnline();
  await settle();
  for (const onReconnect of t.host.items("realtime.reconnect")) onReconnect();
  await settle();
  expect(t.loads()).toBe(3);
});

test("restart does not duplicate window listeners", async () => {
  const t = await start();
  const before = t.browser.listenerCount();
  expect(before).toBeGreaterThan(0);
  await t.host.restart();
  expect(t.browser.listenerCount()).toBe(before);
});
