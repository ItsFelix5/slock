import { afterEach, expect, test } from "bun:test";
import { render } from "@solidjs/web";
import { createComponent } from "solid-js";
import ClickableInline from "../../src/button/ClickableInline";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function mount(className?: string) {
  const calls = { activate: 0 };
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(
    () =>
      createComponent(ClickableInline, {
        class: className,
        children: "#general",
        onActivate: () => {
          calls.activate += 1;
        },
      }),
    host,
  );
  const button = host.querySelector("button");
  if (!button) throw new Error("button missing");
  return { button, calls };
}

test("activates on click", () => {
  const { button, calls } = mount();
  button.click();
  expect(calls.activate).toBe(1);
});

test("stops the click from bubbling to parent handlers", () => {
  const { button } = mount();
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  button.dispatchEvent(event);
  expect(event.cancelBubble).toBe(true);
});

test("is a plain button that does not submit forms", () => {
  const { button } = mount();
  expect(button.type).toBe("button");
});

test("joins extra classes with a single space", () => {
  const { button } = mount("extra");
  expect(button.className.split(/\s+/)).toEqual(["btn-reset", "clickable-inline", "extra"]);
});
