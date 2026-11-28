import { BLOCK_EMBEDS, COLUMNS_EMBED } from "../../lib/canvasEmbedValues";

export const SECTION_ID_ATTRIBUTE = "sid";
export const LAYOUT_ATTRIBUTE = "layout";
export const DIFF_ATTRIBUTE = "diff";
export const DIFF_MARK = "diffmark";
export const ANNOTATION_ATTRIBUTE = "annotation";
export const HTML_TAGS_ATTRIBUTE = "htmltags";

const INLINE_FORMATS = [
  ANNOTATION_ATTRIBUTE,
  "bold",
  "canvasControl",
  "code",
  "date",
  DIFF_MARK,
  "emoji",
  HTML_TAGS_ATTRIBUTE,
  "italic",
  "link",
  "mention",
  "softbreak",
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
];

export const CELL_FORMATS = INLINE_FORMATS;

export const COLUMN_FORMATS = [
  ...INLINE_FORMATS,
  ...BLOCK_FORMATS,
  ...BLOCK_EMBEDS.filter((name) => name !== COLUMNS_EMBED),
];

export const CANVAS_FORMATS = [...COLUMN_FORMATS, COLUMNS_EMBED];
