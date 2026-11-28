import { expect, test } from "bun:test";
import "../../../packages/ui/src/editor/DividerBlot";
import Quill from "../../../packages/ui/src/editor/quill";
import { indexAlignedText, textBefore } from "../../../packages/ui/src/editor/quillText";

test("the text before a position keeps document indexes without reading other lines", () => {
  const quill = new Quill(document.body.appendChild(document.createElement("div")));
  quill.setContents([{ insert: "first\n" }, { insert: { divider: true } }, { insert: "@ada\n" }]);
  const full = indexAlignedText(quill);

  for (let end = 1; end <= full.length; end++) {
    const text = textBefore(quill, end);
    expect(text.length).toBe(end);
    const lineStart = full.lastIndexOf("\n", end - 2) + 1;
    expect(text.slice(lineStart)).toBe(full.slice(lineStart, end));
  }
  expect(textBefore(quill, 11)).toBe("\n\n\n\n\n\n\n@ada");
});
