import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import FloatingPanel from "../../src/overlay/floating/FloatingPanel";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function anchorAt(left: number, top: number) {
  const element = document.createElement("button");
  document.body.append(element);
  spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(left, top, 40, 20));
  return element;
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function mountPanel(initial: HTMLElement) {
  const [anchor, setAnchor] = createSignal(initial);
  const [open, setOpen] = createSignal(true);
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(
    () => (
      <FloatingPanel anchor={anchor} open={open()}>
        <span>content</span>
      </FloatingPanel>
    ),
    host,
  );
  flush();
  const panel = () => document.querySelector<HTMLElement>("[data-placement]");
  return {
    panel,
    setAnchor: (next: HTMLElement) => {
      setAnchor(next);
      flush();
    },
    setOpen: (next: boolean) => {
      setOpen(next);
      flush();
    },
  };
}

describe("FloatingPanel", () => {
  test("positions under its anchor", async () => {
    const view = mountPanel(anchorAt(100, 50));
    await nextFrame();
    expect(view.panel()?.style.left).toBe("100px");
    expect(view.panel()?.style.top).toBe("74px");
    expect(view.panel()?.style.visibility).toBe("visible");
  });

  test("follows the anchor when it is swapped", async () => {
    const view = mountPanel(anchorAt(100, 50));
    await nextFrame();
    view.setAnchor(anchorAt(300, 200));
    await nextFrame();
    expect(view.panel()?.style.left).toBe("300px");
    expect(view.panel()?.style.top).toBe("224px");
  });

  test("closing removes the panel and its resize listener", async () => {
    const removed = spyOn(window, "removeEventListener");
    const view = mountPanel(anchorAt(100, 50));
    await nextFrame();
    view.setOpen(false);
    expect(view.panel()).toBeNull();
    expect(removed.mock.calls.some(([type]) => type === "resize")).toBe(true);
  });
});
