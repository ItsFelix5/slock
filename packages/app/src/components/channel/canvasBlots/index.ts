import Quill from "quill";
import "./CanvasBlockBlot";
import "./CanvasControlBlot";
import "./SoftBreakBlot";

const Parchment = Quill.import("parchment");

export const SECTION_ID_ATTRIBUTE = "sid";

Quill.register(
  new Parchment.Attributor(SECTION_ID_ATTRIBUTE, "data-sid", {
    scope: Parchment.Scope.BLOCK_ATTRIBUTE,
  }),
);

export const CANVAS_FORMATS = [
  "bold",
  "canvasBlock",
  "canvasControl",
  "code",
  "code-block",
  "date",
  "divider",
  "emoji",
  "header",
  "indent",
  "italic",
  "link",
  "list",
  "mention",
  "sid",
  "softbreak",
  "strike",
  "underline",
];
