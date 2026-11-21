import { afterEach, beforeEach, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { useHoverIntent } from "../src/hooks/useHoverIntent";
import { startFakeEnv } from "./fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;
const env = { advance: (ms: number) => fake.env.advance(ms) };

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => fake.stop());

const intent = () => createRoot((dispose) => ({ dispose, ...useHoverIntent(100, 50) }));

test("opens after the open delay", () => {
  const hover = intent();
  hover.scheduleOpen();
  env.advance(99);
  flush();
  expect(hover.open()).toBe(false);
  env.advance(1);
  flush();
  expect(hover.open()).toBe(true);
});

test("leaving before the delay never opens", () => {
  const hover = intent();
  hover.scheduleOpen();
  env.advance(60);
  hover.scheduleClose();
  env.advance(500);
  flush();
  expect(hover.open()).toBe(false);
});

test("repeated enter events leave only one pending open", () => {
  const hover = intent();
  hover.scheduleOpen();
  env.advance(60);
  hover.scheduleOpen();
  hover.scheduleClose();
  env.advance(45);
  flush();
  expect(hover.open()).toBe(false);
});

test("closes after the close delay and re-entering cancels it", () => {
  const hover = intent();
  hover.openNow();
  hover.scheduleClose();
  env.advance(30);
  hover.cancelClose();
  env.advance(500);
  flush();
  expect(hover.open()).toBe(true);
  hover.scheduleClose();
  env.advance(50);
  flush();
  expect(hover.open()).toBe(false);
});

test("close and dispose clear every timer", () => {
  const hover = intent();
  hover.scheduleOpen();
  hover.close();
  env.advance(500);
  flush();
  expect(hover.open()).toBe(false);
  hover.scheduleOpen();
  hover.dispose();
  env.advance(500);
  flush();
  expect(hover.open()).toBe(false);
});
