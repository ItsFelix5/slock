import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { createRoot } from "solid-js";
import { trackPageIdle } from "../src/pageIdle";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function fakeDocument() {
  const listeners: (() => void)[] = [];
  const source = {
    addEventListener: (_type: "visibilitychange", listener: () => void) => listeners.push(listener),
    visibilityState: "visible" as DocumentVisibilityState,
  };
  const show = (state: DocumentVisibilityState) => {
    source.visibilityState = state;
    for (const listener of listeners) listener();
  };
  return { idle: createRoot(() => trackPageIdle(source)), show };
}

test("goes idle after 30 s hidden", () => {
  const page = fakeDocument();
  page.show("hidden");
  jest.advanceTimersByTime(29_999);
  expect(page.idle()).toBe(false);
  jest.advanceTimersByTime(1);
  expect(page.idle()).toBe(true);
});

test("coming back clears idle and cancels a pending idle", () => {
  const page = fakeDocument();
  page.show("hidden");
  jest.advanceTimersByTime(20_000);
  page.show("visible");
  jest.advanceTimersByTime(60_000);
  expect(page.idle()).toBe(false);
  page.show("hidden");
  jest.advanceTimersByTime(30_000);
  expect(page.idle()).toBe(true);
  page.show("visible");
  expect(page.idle()).toBe(false);
});

test("hiding twice does not shorten or stack the timer", () => {
  const page = fakeDocument();
  page.show("hidden");
  jest.advanceTimersByTime(20_000);
  page.show("hidden");
  jest.advanceTimersByTime(20_000);
  expect(page.idle()).toBe(false);
  jest.advanceTimersByTime(10_000);
  expect(page.idle()).toBe(true);
});
