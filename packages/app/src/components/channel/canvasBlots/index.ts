import Quill from "quill";
import "./CanvasControlBlot";
import "./SoftBreakBlot";
import "./embeds";
import { LAYOUT_ATTRIBUTE, SECTION_ID_ATTRIBUTE } from "./formats";

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

export {
  CANVAS_FORMATS,
  CELL_FORMATS,
  COLUMN_FORMATS,
  LAYOUT_ATTRIBUTE,
  SECTION_ID_ATTRIBUTE,
} from "./formats";
