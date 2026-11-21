import { afterEach, describe, expect, test } from "bun:test";
import { createFakeEnv } from "@slock/core/testing";
import { createPaneNav } from "../../src/nav/paneNav";

function buildPanes() {
  document.body.innerHTML = `
    <div data-pane="a"><button data-nav-row>a0</button><button data-nav-row>a1</button><button data-nav-row>a2</button></div>
    <div data-pane="b"><button data-nav-row>b0</button><button data-nav-row>b1</button></div>`;
  const row = (pane: string, index: number) =>
    document.querySelectorAll<HTMLElement>(`[data-pane="${pane}"] [data-nav-row]`)[index];
  return { row };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("pane navigation", () => {
  test("returning to a pane restores the row last focused in it", () => {
    const { row } = buildPanes();
    const nav = createPaneNav(createFakeEnv());
    row("a", 2)?.focus();
    nav.movePane(1);
    expect(document.activeElement?.textContent).toBe("b0");
    nav.movePane(-1);
    expect(document.activeElement?.textContent).toBe("a2");
  });

  test("a new instance does not remember another instance's rows", () => {
    const { row } = buildPanes();
    const first = createPaneNav(createFakeEnv());
    row("a", 2)?.focus();
    first.movePane(1);
    const second = createPaneNav(createFakeEnv());
    second.movePane(-1);
    expect(document.activeElement?.textContent).toBe("a0");
  });

  test("focusById reports whether the pane exists", () => {
    buildPanes();
    const nav = createPaneNav(createFakeEnv());
    expect(nav.focusById("b")).toBe(true);
    expect(document.activeElement?.textContent).toBe("b0");
    expect(nav.focusById("missing")).toBe(false);
  });
});
