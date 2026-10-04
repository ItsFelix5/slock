import Quill from "quill";
import "./CanvasControlBlot";
import "./SoftBreakBlot";
import "./embeds";
import {
  ANNOTATION_ATTRIBUTE,
  DIFF_ATTRIBUTE,
  DIFF_MARK,
  LAYOUT_ATTRIBUTE,
  SECTION_ID_ATTRIBUTE,
} from "./formats";

const Parchment = Quill.import("parchment");

Quill.register(
  new Parchment.Attributor(SECTION_ID_ATTRIBUTE, "data-sid", {
    scope: Parchment.Scope.BLOCK_ATTRIBUTE,
  }),
);

Quill.register(
  new Parchment.Attributor(LAYOUT_ATTRIBUTE, "data-layout", {
    scope: Parchment.Scope.BLOCK_ATTRIBUTE,
  }),
);

Quill.register(
  new Parchment.Attributor(ANNOTATION_ATTRIBUTE, "data-annotation", {
    scope: Parchment.Scope.INLINE_ATTRIBUTE,
  }),
);

Quill.register(
  new Parchment.Attributor(DIFF_ATTRIBUTE, "data-diff", {
    scope: Parchment.Scope.BLOCK_ATTRIBUTE,
  }),
);

Quill.register(
  new Parchment.ClassAttributor(DIFF_MARK, "canvas-diff", {
    scope: Parchment.Scope.INLINE_ATTRIBUTE,
    whitelist: ["added", "removed"],
  }),
);

export {
  ANNOTATION_ATTRIBUTE,
  CANVAS_FORMATS,
  CELL_FORMATS,
  COLUMN_FORMATS,
  LAYOUT_ATTRIBUTE,
  SECTION_ID_ATTRIBUTE,
} from "./formats";
