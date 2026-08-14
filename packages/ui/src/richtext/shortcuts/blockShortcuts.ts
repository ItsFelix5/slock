import type { BlockShortcutMatch } from "../blockConvert";

// Each pattern must match a paragraph's *entire* flat text (block shortcuts only fire out of a
// plain, still-empty-of-content paragraph) — so pasting a line that happens to start with "# "
// never accidentally converts a block, only genuinely typing the trigger does.
const HEADING_RE = /^(#+)\s$/;
const CONTEXT_RE = /^-#\s$/;
const QUOTE_RE = /^>\s$/;
const BULLET_RE = /^[-*]\s$/;
const ORDERED_RE = /^\d+\.\s$/;
const CHECKBOX_RE = /^\[([ xX])\]\s$/;
const CODEBLOCK_RE = /^```$/;
const DIVIDER_RE = /^---$/;

/** Mirrors `detectMarkShortcut`'s shape but at block granularity — pure `(text) -> match | null`,
 * called from `EditorView` on input against the current block's full flat text. */
export function detectBlockShortcut(text: string): BlockShortcutMatch | null {
  const heading = HEADING_RE.exec(text);
  if (heading) return { kind: "heading", level: heading[1].length };
  if (CONTEXT_RE.test(text)) return { kind: "context" };
  if (QUOTE_RE.test(text)) return { kind: "quote" };
  if (BULLET_RE.test(text)) return { kind: "list", listStyle: "bullet" };
  if (ORDERED_RE.test(text)) return { kind: "list", listStyle: "ordered" };
  const checkbox = CHECKBOX_RE.exec(text);
  if (checkbox) return { checked: checkbox[1] !== " ", kind: "list", listStyle: "checkbox" };
  if (CODEBLOCK_RE.test(text)) return { kind: "codeblock" };
  if (DIVIDER_RE.test(text)) return { kind: "divider" };
  return null;
}
