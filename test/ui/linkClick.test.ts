import { afterEach, expect, test } from "bun:test";
import { onLinkClick } from "../../packages/ui/src/linkClick";

let cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  document.body.replaceChildren();
});

function link(href: string, parent: HTMLElement = document.body) {
  const anchor = document.createElement("a");
  anchor.href = href;
  parent.append(anchor);
  return anchor;
}

function click(target: HTMLElement, init: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

test("sees link clicks even when a body-level handler stops propagation", () => {
  const seen: string[] = [];
  const stopAtBody = (event: Event) => event.stopPropagation();
  document.body.addEventListener("click", stopAtBody);
  cleanups.push(() => document.body.removeEventListener("click", stopAtBody));
  cleanups.push(
    onLinkClick((anchor) => {
      seen.push(anchor.href);
      return true;
    }),
  );

  const anchor = link("https://acme.slack.com/archives/C123/p1700000000123456");
  const event = click(anchor);

  expect(seen).toEqual([anchor.href]);
  expect(event.defaultPrevented).toBe(true);
});

test("ignores non-links, modified clicks and editable links", () => {
  const seen: string[] = [];
  cleanups.push(
    onLinkClick((anchor) => {
      seen.push(anchor.href);
      return true;
    }),
  );

  const anchor = link("https://acme.slack.com/docs/T1/F1");
  click(document.body);
  click(anchor, { ctrlKey: true });
  click(anchor, { button: 1 });

  const editor = document.createElement("div");
  editor.contentEditable = "true";
  document.body.append(editor);
  click(link("https://acme.slack.com/docs/T1/F2", editor));

  expect(seen).toEqual([]);
});

test("leaves the click alone when the handler declines it", () => {
  cleanups.push(onLinkClick(() => false));

  const event = click(link("https://example.com/"));

  expect(event.defaultPrevented).toBe(false);
});

test("stops listening after cleanup", () => {
  const seen: string[] = [];
  const stop = onLinkClick((anchor) => {
    seen.push(anchor.href);
    return true;
  });
  stop();

  click(link("https://acme.slack.com/docs/T1/F1"));

  expect(seen).toEqual([]);
});
