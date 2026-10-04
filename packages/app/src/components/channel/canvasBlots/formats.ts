import {
  COLUMNS_EMBED,
  DIVIDER_EMBED,
  FILE_EMBED,
  IMAGE_EMBED,
  TABLE_EMBED,
} from "../../../lib/canvas/canvasEmbedValues";

export const SECTION_ID_ATTRIBUTE = "sid";
export const LAYOUT_ATTRIBUTE = "layout";
export const DIFF_ATTRIBUTE = "diff";
export const DIFF_MARK = "diffmark";
export const ANNOTATION_ATTRIBUTE = "annotation";

const INLINE_FORMATS = [
  ANNOTATION_ATTRIBUTE,
  "bold",
  "canvasControl",
  "code",
  "date",
  DIFF_MARK,
  "emoji",
  "italic",
  "link",
  "mention",
  "strike",
  "underline",
];

const BLOCK_FORMATS = [
  "code-block",
  DIFF_ATTRIBUTE,
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
