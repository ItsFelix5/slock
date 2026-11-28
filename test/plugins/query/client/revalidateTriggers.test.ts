import { afterEach, expect, test } from "bun:test";
import { installRevalidateTriggers } from "../../../../packages/plugins/src/query/client/revalidateTriggers";
import { createFakeEnv } from "../../../support/core";
import { installFakeBrowser } from "../../realtime/support/fakeBrowser";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const env = createFakeEnv();
  const browser = installFakeBrowser({ online: true });
  let calls = 0;
  const dispose = installRevalidateTriggers({
    now: env.now,
    onRevalidate: () => {
      calls += 1;
    },
  });
  cleanups.push(browser.restore);
  return { browser, calls: () => calls, dispose, env };
}

test("revalidates when the page returns after being hidden a while", () => {
  const t = setup();
  t.browser.setVisible(false);
  t.env.advance(60_000);
  t.browser.setVisible(true);
  expect(t.calls()).toBe(1);
});

test("does not revalidate for a brief tab switch", () => {
  const t = setup();
  t.browser.setVisible(false);
  t.env.advance(5_000);
  t.browser.setVisible(true);
  expect(t.calls()).toBe(0);
});

test("revalidates when back online and stops after dispose", () => {
  const t = setup();
  t.browser.goOnline();
  expect(t.calls()).toBe(1);
  t.dispose();
  t.env.advance(60_000);
  t.browser.goOnline();
  expect(t.calls()).toBe(1);
  expect(t.browser.listenerCount()).toBe(0);
});

test("all sources share one throttle", () => {
  const t = setup();
  t.browser.setVisible(false);
  t.env.advance(60_000);
  t.browser.goOnline();
  t.browser.setVisible(true);
  expect(t.calls()).toBe(1);
  t.env.advance(5_000);
  t.browser.goOnline();
  expect(t.calls()).toBe(2);
});
