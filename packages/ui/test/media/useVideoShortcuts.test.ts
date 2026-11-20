import { afterEach, describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { useVideoShortcuts } from "../../src/media/video/useVideoShortcuts";

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

function element(tag: string, parent: Element, attributes: Record<string, string> = {}) {
  const created = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) created.setAttribute(name, value);
  parent.append(created);
  return created;
}

function mount(state = { currentTime: 20, duration: 100 }) {
  const log: string[] = [];
  const outside = element("div", document.body);
  const wrap = element("div", document.body);
  const seek = element("div", wrap, { tabindex: "0" });
  const button = element("button", wrap, { type: "button" });
  const range = element("input", wrap, { type: "range" });
  disposers.push(
    createRoot((dispose) => {
      useVideoShortcuts({
        currentTime: () => state.currentTime,
        duration: () => state.duration,
        root: () => wrap,
        seekRoot: () => seek,
        seekTo: (ratio) => log.push(`seek ${ratio}`),
        toggleFullscreen: () => log.push("fullscreen"),
        toggleMute: () => log.push("mute"),
        togglePlayback: () => log.push("play"),
      });
      return dispose;
    }),
  );
  flush();
  return { button, log, outside, range, seek, wrap };
}

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
      ...init,
    }),
  );
}

describe("play, mute and fullscreen", () => {
  test.each([" ", "k"])("%j toggles playback from the seek bar", (key) => {
    const { log, seek } = mount();
    press(seek, key);
    expect(log).toEqual(["play"]);
  });

  test("space on a button is left to the button", () => {
    const { button, log } = mount();
    press(button, " ");
    expect(log).toEqual([]);
  });

  test("m and f work from anywhere inside the player", () => {
    const { button, log, seek } = mount();
    press(seek, "m");
    press(button, "f");
    expect(log).toEqual(["mute", "fullscreen"]);
  });

  test("keys are ignored inside inputs", () => {
    const { log, range } = mount();
    press(range, "m");
    press(range, "k");
    expect(log).toEqual([]);
  });

  test("keys are ignored outside the player", () => {
    const { log, outside } = mount();
    for (const key of [" ", "k", "m", "f", "ArrowRight"]) press(outside, key);
    expect(log).toEqual([]);
  });
});

describe("seeking", () => {
  test("arrows step 5 seconds as a ratio of the duration", () => {
    const { log, seek } = mount({ currentTime: 20, duration: 100 });
    press(seek, "ArrowRight");
    press(seek, "ArrowLeft");
    expect(log).toEqual(["seek 0.25", "seek 0.15"]);
  });

  test("home and end jump to the edges", () => {
    const { log, seek } = mount();
    press(seek, "Home");
    press(seek, "End");
    expect(log).toEqual(["seek 0", "seek 1"]);
  });

  test("arrows only seek while the seek bar has focus", () => {
    const { button, log } = mount();
    press(button, "ArrowRight");
    expect(log).toEqual([]);
  });
});

test("nothing fires after the player is disposed", () => {
  const { log, seek } = mount();
  for (const dispose of disposers.splice(0)) dispose();
  press(seek, " ");
  press(seek, "ArrowRight");
  expect(log).toEqual([]);
});
