import { describe, expect, test } from "bun:test";
import "../../../packages/ui/src/editor/DividerBlot";
import { wireListOffsetCleanup } from "../../../packages/ui/src/editor/listOffset";
import Quill from "../../../packages/ui/src/editor/quill";
import { quillKeyboardBindings } from "../../../packages/ui/src/editor/quillKeyboard";

function mount(formats: string[]) {
  const quill: Quill = new Quill(document.body.appendChild(document.createElement("div")), {
    formats,
    modules: { keyboard: { bindings: quillKeyboardBindings(() => quill, formats, false) } },
  });
  return quill;
}

function typeSpaceAfter(quill: Quill, prefix: string) {
  quill.setText(`${prefix}\n`);
  quill.setSelection(prefix.length, 0);
  quill.root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
  return quill.getContents().ops;
}

describe("list prefixes", () => {
  test("a start number is kept where the editor can store it", () => {
    expect(typeSpaceAfter(mount(["list", "listOffset"]), "3.")).toEqual([
      { attributes: { list: "ordered", listOffset: "2" }, insert: "\n" },
    ]);
  });

  test("a start number stays as typed where the editor cannot store it", () => {
    expect(typeSpaceAfter(mount(["list"]), "3.")).toEqual([{ insert: "3.\n" }]);
    expect(typeSpaceAfter(mount(["list"]), "1.")).toEqual([
      { attributes: { list: "ordered" }, insert: "\n" },
    ]);
  });

  test("editors without lists keep the typed prefix", () => {
    expect(typeSpaceAfter(mount(["bold"]), "-")).toEqual([{ insert: "-\n" }]);
  });
});

test("typing drops list offsets left on plain lines, next to block embeds too", () => {
  const quill = mount(["divider", "list", "listOffset"]);
  wireListOffsetCleanup(quill);
  quill.setContents([
    { insert: "kept" },
    { attributes: { list: "ordered", listOffset: 2 }, insert: "\n" },
    { insert: { divider: true } },
    { insert: "stale" },
    { attributes: { listOffset: 4 }, insert: "\n" },
  ]);

  quill.insertText(0, "a", "user");

  expect(quill.getContents().ops).toEqual([
    { insert: "akept" },
    { attributes: { list: "ordered", listOffset: "2" }, insert: "\n" },
    { insert: { divider: true } },
    { insert: "stale\n" },
  ]);
});
