import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { useHoverIntent } from "../src/hooks/useHoverIntent";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const intent = () => createRoot((dispose) => ({ dispose, ...useHoverIntent(100, 50) }));

test("opens after the open delay", () => {
  const hover = intent();
  hover.scheduleOpen();
  jest.advanceTimersByTime(99);
  flush();
  expect(hover.open()).toBe(false);
  jest.advanceTimersByTime(1);
  flush();
  expect(hover.open()).toBe(true);
});

test("leaving before the delay never opens", () => {
  const hover = intent();
  hover.scheduleOpen();
  jest.advanceTimersByTime(60);
  hover.scheduleClose();
  jest.advanceTimersByTime(500);
  flush();
  expect(hover.open()).toBe(false);
});

test("repeated enter events leave only one pending open", () => {
  const hover = intent();
  hover.scheduleOpen();
  jest.advanceTimersByTime(60);
  hover.scheduleOpen();
  hover.scheduleClose();
  jest.advanceTimersByTime(45);
  flush();
  expect(hover.open()).toBe(false);
});

test("closes after the close delay and re-entering cancels it", () => {
  const hover = intent();
  hover.openNow();
  hover.scheduleClose();
  jest.advanceTimersByTime(30);
  hover.cancelClose();
  jest.advanceTimersByTime(500);
  flush();
  expect(hover.open()).toBe(true);
  hover.scheduleClose();
  jest.advanceTimersByTime(50);
  flush();
  expect(hover.open()).toBe(false);
});

test("close and dispose clear every timer", () => {
  const hover = intent();
  hover.scheduleOpen();
  hover.close();
  jest.advanceTimersByTime(500);
  flush();
  expect(hover.open()).toBe(false);
  hover.scheduleOpen();
  hover.dispose();
  jest.advanceTimersByTime(500);
  flush();
  expect(hover.open()).toBe(false);
});
