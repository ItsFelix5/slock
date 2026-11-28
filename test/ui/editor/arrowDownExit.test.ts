import { expect, test } from "bun:test";
import { wireArrowDownExit } from "../../../packages/ui/src/editor/markdownAutoformat";
import Quill from "../../../packages/ui/src/editor/quill";

function arrowDown(ops: Parameters<Quill["setContents"]>[0], index?: number) {
  const quill = new Quill(document.body.appendChild(document.createElement("div")));
  wireArrowDownExit(quill);
  quill.setContents(ops);
  quill.setSelection(index ?? quill.getLength() - 1, 0);
  quill.root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
  return quill.getContents().ops;
}

test("arrow down leaves a list alone", () => {
  const ops = [{ insert: "item" }, { attributes: { list: "bullet" }, insert: "\n" }];
  expect(arrowDown(ops)).toEqual(ops);
});

test("arrow down only exits a block on the last line of the document", () => {
  const code = [{ insert: "code" }, { attributes: { "code-block": true }, insert: "\n" }];
  const followed = [...code, { insert: "after\n" }];
  expect(arrowDown(followed, 4)).toEqual(followed);
  expect(arrowDown(code)).toEqual([...code, { insert: "\n" }]);
});
