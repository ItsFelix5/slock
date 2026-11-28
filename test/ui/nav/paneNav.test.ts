import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { createPaneNav } from "../../../packages/ui/src/nav/paneNav";
import { createFakeEnv } from "../../support/core";

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

describe("entering a pane to write", () => {
  const editor = `<div class="composer"><div contenteditable="true">box</div></div>`;

  test("focuses the message box as soon as it appears", async () => {
    document.body.innerHTML = `<div data-pane="t"><button data-nav-row>row</button></div>`;
    createPaneNav(createFakeEnv()).focusById("t", "composer");
    document.querySelector("[data-pane]")?.insertAdjacentHTML("beforeend", editor);
    await Bun.sleep(0);
    expect(document.activeElement?.textContent).toBe("box");
  });

  test("a row that loads late does not take focus from the message box", async () => {
    document.body.innerHTML = `<div data-pane="t"><div class="message-list"></div>${editor}</div><button>out</button>`;
    document.querySelector<HTMLElement>("body > button")?.focus();
    createPaneNav(createFakeEnv()).focusById("t");
    document.querySelector<HTMLElement>("[contenteditable]")?.focus();
    document
      .querySelector(".message-list")
      ?.insertAdjacentHTML("beforeend", `<div data-message-ts="1.1" tabindex="0">row</div>`);
    await Bun.sleep(0);
    expect(document.activeElement?.textContent).toBe("box");
  });
});

describe("entering a message feed", () => {
  test("focuses the roving row without scrolling the feed", () => {
    document.body.innerHTML = `<div data-pane="feed"><div class="message-list"><div data-message-ts="1.1" tabindex="0"></div></div></div>`;
    const row = document.querySelector<HTMLElement>("[data-message-ts]");
    if (!row) throw new Error("row missing");
    const focus = spyOn(row, "focus");
    createPaneNav(createFakeEnv()).focusById("feed");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
