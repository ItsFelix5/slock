import { afterEach, expect, test } from "bun:test";
import { installRevalidateTriggers } from "../../../src/query/client/revalidateTriggers";
import { installFakeBrowser } from "../../realtime/support/fakeBrowser";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const browser = installFakeBrowser({ online: true });
  let time = 0;
  let calls = 0;
  const teardown = installRevalidateTriggers({
    now: () => time,
    onRevalidate: () => {
      calls += 1;
    },
  });
  cleanups.push(browser.restore);
  return {
    advance(ms: number) {
      time += ms;
    },
    browser,
    calls: () => calls,
    teardown,
  };
}

test("revalidates when the page returns after being hidden a while", () => {
  const t = setup();
  t.browser.setVisible(false);
  t.advance(60_000);
  t.browser.setVisible(true);
  expect(t.calls()).toBe(1);
});

test("does not revalidate for a brief tab switch", () => {
  const t = setup();
  t.browser.setVisible(false);
  t.advance(5_000);
  t.browser.setVisible(true);
  expect(t.calls()).toBe(0);
});

test("revalidates on reconnect and stops after teardown", () => {
  const t = setup();
  t.browser.goOnline();
  expect(t.calls()).toBe(1);
  t.teardown();
  t.browser.goOnline();
  expect(t.calls()).toBe(1);
});
