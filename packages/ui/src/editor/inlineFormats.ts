import { INLINE_MARKS } from "./markdownAutoformat";

export const INLINE_STYLE_FORMATS = [
  ...INLINE_MARKS.map(([, format]) => format),
  "underline",
  "client_highlight",
] as const;

export type InlineFormat = (typeof INLINE_STYLE_FORMATS)[number];
