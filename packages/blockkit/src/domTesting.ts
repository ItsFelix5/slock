import type { JSX } from "solid-js";
import { render } from "solid-js/web";

const disposers: (() => void)[] = [];

export function mount(view: () => JSX.Element): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  disposers.push(render(view, host));
  return host;
}

export function unmountAll() {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
}

export function pressKey(element: Element, key: string) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
  element.dispatchEvent(event);
  return event;
}

export function attrs(host: Element, selector: string, attribute: string): (string | null)[] {
  return [...host.querySelectorAll(selector)].map((element) => element.getAttribute(attribute));
}

export function count(host: Element, selector: string): number {
  return host.querySelectorAll(selector).length;
}
