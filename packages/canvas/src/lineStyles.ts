import type { CanvasLine } from "@slock/types";

export const STYLE_PARAGRAPH = 0;
export const STYLE_CODE = 4;
export const STYLE_DIVIDER = 18;
export const STYLE_LIST_BULLET = 5;
export const STYLE_LIST_ORDERED = 6;
export const STYLE_LIST_CHECKLIST = 7;
export const STYLE_QUOTE = 50;
export const STYLE_TITLE = 48;
export const TYPE_TEXT = 0;
export const TYPE_LIST = 1;
export const TYPE_DIVIDER = 16;
export const TYPE_QUOTE = 71;
export const TYPE_TITLE = 64;

const HEADING_STYLES = [1, 2, 3, 39, 40, 41];

type LineShape = Pick<CanvasLine, "kind" | "level">;

export function lineShapeForStyle(style: number): LineShape {
  const headingIndex = HEADING_STYLES.indexOf(style);
  if (headingIndex >= 0) return { kind: "heading", level: headingIndex + 1 };
  if (style === STYLE_CODE) return { kind: "code", level: 0 };
  return { kind: "paragraph", level: 0 };
}

export function styleForLine(line: Pick<CanvasLine, "kind" | "level">): number {
  if (line.kind === "heading") return HEADING_STYLES[line.level - 1] ?? HEADING_STYLES[0] ?? 1;
  if (line.kind === "code") return STYLE_CODE;
  return STYLE_PARAGRAPH;
}

export function listStyleForKind(kind: CanvasLine["kind"]): number | null {
  if (kind === "bullet") return STYLE_LIST_BULLET;
  if (kind === "ordered") return STYLE_LIST_ORDERED;
  if (kind === "checklist") return STYLE_LIST_CHECKLIST;
  return null;
}

export function groupStyleForKind(kind: CanvasLine["kind"]): number | null {
  return kind === "quote" ? STYLE_QUOTE : listStyleForKind(kind);
}

export function listKindForStyle(style: number): CanvasLine["kind"] | null {
  if (style === STYLE_LIST_BULLET) return "bullet";
  if (style === STYLE_LIST_ORDERED) return "ordered";
  if (style === STYLE_LIST_CHECKLIST) return "checklist";
  return null;
}
