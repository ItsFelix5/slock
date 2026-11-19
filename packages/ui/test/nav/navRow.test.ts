import { afterEach, describe, expect, test } from "bun:test";
import { createComponent } from "solid-js";
import { render } from "@solidjs/web";
import NavRow from "../../src/nav/NavRow";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function child(tag: string, className: string, attributes: Record<string, string> = {}) {
  const element = document.createElement(tag);
  element.className = className;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function mount() {
  const calls = { activate: 0 };
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(
    () =>
      createComponent(NavRow, {
        class: "row",
        onActivate: () => {
          calls.activate += 1;
        },
        tabIndex: -1,
        get children() {
          return [
            child("span", "label"),
            child("button", "nested-button", { type: "button" }),
            child("a", "nested-link", { href: "https://example.com" }),
            child("input", "nested-input"),
          ];
        },
      }),
    host,
  );
  const row = host.querySelector<HTMLElement>(".row");
  if (!row) throw new Error("row missing");
  return { calls, row };
}

function find(row: Element, selector: string) {
  const element = row.querySelector(selector);
  if (!element) throw new Error(`${selector} missing`);
  return element;
}

function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function press(element: Element, key: string, repeat = false) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, repeat });
  element.dispatchEvent(event);
  return event;
}

describe("NavRow click", () => {
  test("activates on a click on the row itself", () => {
    const { calls, row } = mount();
    click(row);
    expect(calls.activate).toBe(1);
  });

  test("activates on a click on plain content", () => {
    const { calls, row } = mount();
    click(find(row, ".label"));
    expect(calls.activate).toBe(1);
  });

  test.each([
    ".nested-button",
    ".nested-link",
    ".nested-input",
  ])("ignores a click on %s", (selector) => {
    const { calls, row } = mount();
    click(find(row, selector));
    expect(calls.activate).toBe(0);
  });
});

describe("NavRow keyboard", () => {
  test.each(["Enter", " "])("activates on %j and prevents the default", (key) => {
    const { calls, row } = mount();
    const event = press(row, key);
    expect(calls.activate).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  test("ignores other keys", () => {
    const { calls, row } = mount();
    const event = press(row, "a");
    expect(calls.activate).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  test("ignores key repeat but still blocks scrolling", () => {
    const { calls, row } = mount();
    const event = press(row, " ", true);
    expect(calls.activate).toBe(0);
    expect(event.defaultPrevented).toBe(true);
  });

  test("ignores keys pressed inside a nested control", () => {
    const { calls, row } = mount();
    press(find(row, ".nested-button"), "Enter");
    press(find(row, ".nested-input"), " ");
    expect(calls.activate).toBe(0);
  });

  test("exposes the row as a focusable button", () => {
    const { row } = mount();
    expect(row.getAttribute("role")).toBe("button");
    expect(row.tabIndex).toBe(-1);
    expect(row.hasAttribute("data-nav-row")).toBe(true);
  });
});
