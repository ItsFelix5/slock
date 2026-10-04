import {
  COLUMNS_EMBED,
  DIVIDER_EMBED,
  FILE_EMBED,
  IMAGE_EMBED,
  TABLE_EMBED,
} from "../../../lib/canvas/canvasEmbedValues";

export const SECTION_ID_ATTRIBUTE = "sid";
export const LAYOUT_ATTRIBUTE = "layout";

const INLINE_FORMATS = [
  "bold",
  "canvasControl",
  "code",
  "date",
  "emoji",
  "italic",
  "link",
  "mention",
  "strike",
  "underline",
];

const BLOCK_FORMATS = [
  "code-block",
  "header",
  "indent",
  LAYOUT_ATTRIBUTE,
  "list",
  SECTION_ID_ATTRIBUTE,
  "softbreak",
];

export const CELL_FORMATS = INLINE_FORMATS;

export const COLUMN_FORMATS = [
  ...INLINE_FORMATS,
  ...BLOCK_FORMATS,
  DIVIDER_EMBED,
  FILE_EMBED,
  IMAGE_EMBED,
  TABLE_EMBED,
];

export const CANVAS_FORMATS = [...COLUMN_FORMATS, COLUMNS_EMBED];
