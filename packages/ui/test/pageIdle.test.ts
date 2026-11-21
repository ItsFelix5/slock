import { afterEach, beforeEach, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { trackPageIdle } from "../src/pageIdle";
import { startFakeEnv } from "./fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;
const env = { advance: (ms: number) => fake.env.advance(ms) };

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => fake.stop());

function fakeDocument() {
  const listeners: (() => void)[] = [];
  const source = {
    addEventListener: (_type: "visibilitychange", listener: () => void) => listeners.push(listener),
    removeEventListener: (_type: "visibilitychange", listener: () => void) =>
      listeners.splice(listeners.indexOf(listener), 1),
    visibilityState: "visible" as DocumentVisibilityState,
  };
  const show = (state: DocumentVisibilityState) => {
    source.visibilityState = state;
    for (const listener of listeners) listener();
  };
  return { idle: createRoot(() => trackPageIdle(fake.env, source).idle), show };
}

test("goes idle after 30 s hidden", () => {
  const page = fakeDocument();
  page.show("hidden");
  env.advance(29_999);
  flush();
  expect(page.idle()).toBe(false);
  env.advance(1);
  flush();
  expect(page.idle()).toBe(true);
});

test("coming back clears idle and cancels a pending idle", () => {
  const page = fakeDocument();
  page.show("hidden");
  env.advance(20_000);
  page.show("visible");
  env.advance(60_000);
  flush();
  expect(page.idle()).toBe(false);
  page.show("hidden");
  env.advance(30_000);
  flush();
  expect(page.idle()).toBe(true);
  page.show("visible");
  flush();
  expect(page.idle()).toBe(false);
});

test("hiding twice does not shorten or stack the timer", () => {
  const page = fakeDocument();
  page.show("hidden");
  env.advance(20_000);
  page.show("hidden");
  env.advance(20_000);
  flush();
  expect(page.idle()).toBe(false);
  env.advance(10_000);
  flush();
  expect(page.idle()).toBe(true);
});
