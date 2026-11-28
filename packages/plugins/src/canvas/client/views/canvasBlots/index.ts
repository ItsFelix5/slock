import Quill from "@slock/ui/editor/quill";
import CodeBlock from "quill/formats/code";
import AnnotationBlot from "./annotationBlot";
import CanvasControlBlot from "./canvasControlBlot";
import "./softBreakBlot";
import "./embeds";
import {
  DIFF_ATTRIBUTE,
  DIFF_MARK,
  HTML_TAGS_ATTRIBUTE,
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
  new Parchment.Attributor(HTML_TAGS_ATTRIBUTE, "data-html-tags", {
    scope: Parchment.Scope.INLINE_ATTRIBUTE,
  }),
);

Quill.register(AnnotationBlot);

// Quill strips marks and embeds from code blocks, which would orphan comments and drop references.
CodeBlock.allowedChildren = [...CodeBlock.allowedChildren, AnnotationBlot, CanvasControlBlot];

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
  LAYOUT_ATTRIBUTE,
  SECTION_ID_ATTRIBUTE,
} from "./formats";
