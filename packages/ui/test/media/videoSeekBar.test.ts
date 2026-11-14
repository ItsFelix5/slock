import { afterEach, expect, test } from "bun:test";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import VideoSeekBar from "../../src/media/VideoSeekBar";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function mount(overrides: { buffered?: number; currentTime?: number; duration?: number } = {}) {
  const refs: HTMLElement[] = [];
  const scrubs: PointerEvent[] = [];
  const host = document.createElement("div");
  document.body.append(host);
  const currentTime = overrides.currentTime ?? 30;
  const duration = overrides.duration ?? 120;
  dispose = render(
    () =>
      createComponent(VideoSeekBar, {
        buffered: overrides.buffered ?? 60,
        currentTime,
        duration,
        onScrub: (event) => scrubs.push(event),
        progress: duration > 0 ? currentTime / duration : 0,
        ref: (element) => refs.push(element),
        valueText: "0:30 of 2:00",
      }),
    host,
  );
  const slider = host.querySelector<HTMLElement>('[role="slider"]');
  if (!slider) throw new Error("slider missing");
  const width = (selector: string) => host.querySelector<HTMLElement>(selector)?.style.width;
  return { refs, scrubs, slider, width };
}

test("is a focusable slider with a readable value", () => {
  const { slider } = mount();
  expect(slider.tabIndex).toBe(0);
  expect(slider.getAttribute("aria-valuemin")).toBe("0");
  expect(slider.getAttribute("aria-valuemax")).toBe("120");
  expect(slider.getAttribute("aria-valuenow")).toBe("30");
  expect(slider.getAttribute("aria-valuetext")).toBe("0:30 of 2:00");
});

test("hands the slider element to ref", () => {
  const { refs, slider } = mount();
  expect(refs).toEqual([slider]);
});

test("sizes buffered and played from the ratios", () => {
  const { width } = mount();
  expect(width(".video-player-seek-buffered")).toBe("50%");
  expect(width(".video-player-seek-played")).toBe("25%");
});

test("clamps buffered to the full width", () => {
  const { width } = mount({ buffered: 500 });
  expect(width(".video-player-seek-buffered")).toBe("100%");
});

test("shows an empty bar while the duration is unknown", () => {
  const { width } = mount({ buffered: 10, currentTime: 0, duration: 0 });
  expect(width(".video-player-seek-buffered")).toBe("0%");
  expect(width(".video-player-seek-played")).toBe("0%");
});

test("reports pointer presses to the scrub handler", () => {
  const { scrubs, slider } = mount();
  slider.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  expect(scrubs).toHaveLength(1);
});
