import { describe, expect, spyOn, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { createLinkEditController } from "../../../packages/ui/src/editor/format/linkEdit";
import Quill from "../../../packages/ui/src/editor/quill";

function mount(text: string, url: string) {
  const host = document.body.appendChild(document.createElement("div"));
  const quill = new Quill(host);
  quill.setContents([{ attributes: { link: url }, insert: text }, { insert: "\n" }]);
  const controller = createRoot(() => createLinkEditController(() => quill));
  const anchor = quill.root.querySelector("a");
  if (!anchor) throw new Error("no link rendered");
  controller.handleClick({ preventDefault() {}, target: anchor } as unknown as MouseEvent);
  flush();
  return { controller, quill };
}

describe("link edit", () => {
  test("emptying the url removes the link", () => {
    const { controller, quill } = mount("docs", "https://a.test");
    controller.update("", "docs");
    expect(quill.getContents().ops).toEqual([{ insert: "docs\n" }]);
  });

  test("emptying the url while changing the text removes the link", () => {
    const { controller, quill } = mount("docs", "https://a.test");
    controller.update("", "manual");
    expect(quill.getContents().ops).toEqual([{ insert: "manual\n" }]);
  });
});

function mountReadonly(editableRoot: boolean) {
  const host = document.body.appendChild(document.createElement("div"));
  const quill = new Quill(host);
  quill.setContents([{ attributes: { link: "https://a.test" }, insert: "docs" }, { insert: "\n" }]);
  quill.disable();
  if (editableRoot) quill.root.contentEditable = "plaintext-only";
  const controller = createRoot(() => createLinkEditController(() => quill));
  quill.root.addEventListener("click", controller.handleClick);
  const anchor = quill.root.querySelector("a");
  if (!anchor) throw new Error("no link rendered");
  const click = () => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    flush();
    return event;
  };
  return { anchor, click, controller };
}

describe("link click in a disabled editor", () => {
  test("is left to the browser, with no popover", () => {
    const { click, controller } = mountReadonly(false);
    expect(click().defaultPrevented).toBe(false);
    expect(controller.state()).toBeUndefined();
  });

  test("opens the link when only the caret keeps the editor editable", () => {
    const open = spyOn(window, "open").mockReturnValue(null);
    const { anchor, click, controller } = mountReadonly(true);
    window.getSelection()?.collapse(anchor.firstChild, 1);
    click();
    expect(open.mock.calls[0]?.[0]).toBe("https://a.test/");
    expect(controller.state()).toBeUndefined();
    open.mockRestore();
  });
});
