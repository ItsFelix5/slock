import type Quill from "quill";
import { indexAlignedText } from "./quillText";

const URL_TAIL_RE = /https?:\/\/[^\s<>]+$/;
const BARE_URL_RE = /^https?:\/\/\S+$/;
const TRAILING_PUNCTUATION_RE = /[),.!?;:'"]+$/;
const BOUNDARY_RE = /[ \n]/;

function insertedLength(delta: { ops?: { insert?: unknown }[] }): number {
  let length = 0;
  for (const op of delta.ops ?? []) {
    if (typeof op.insert === "string") length += op.insert.length;
    else if (op.insert !== undefined) length += 1;
  }
  return length;
}

function insertEndIndex(delta: { ops?: { retain?: unknown; insert?: unknown }[] }): number {
  let index = 0;
  for (const op of delta.ops ?? []) {
    if (typeof op.retain === "number") index += op.retain;
    else if (typeof op.insert === "string") index += op.insert.length;
    else if (op.insert !== undefined) index += 1;
  }
  return index;
}

function urlBefore(
  text: string,
  rawEnd: number,
): { start: number; end: number; url: string } | undefined {
  const end = BOUNDARY_RE.test(text[rawEnd - 1] ?? "") ? rawEnd - 1 : rawEnd;
  const match = text.slice(0, end).match(URL_TAIL_RE);
  if (!match) return;
  const trimmed = match[0].replace(TRAILING_PUNCTUATION_RE, "");
  if (!trimmed) return;
  const start = end - match[0].length;
  return { end: start + trimmed.length, start, url: trimmed };
}

function linkifyUrlEndingAt(quill: Quill, end: number): void {
  const found = urlBefore(indexAlignedText(quill), end);
  if (!found) return;
  const format = quill.getFormat(found.start, found.end - found.start);
  if (format.link || format.code || format["code-block"]) return;
  quill.formatText(found.start, found.end - found.start, "link", found.url, "api");
}

export function wireLinkAutoconvert(quill: Quill): void {
  quill.on("text-change", (delta, _old, source) => {
    if (source !== "user") return;
    const cursor = insertEndIndex(delta);
    if (insertedLength(delta) <= 1) {
      const justTyped = indexAlignedText(quill)[cursor - 1];
      if (!(justTyped && BOUNDARY_RE.test(justTyped))) return;
      linkifyUrlEndingAt(quill, cursor);
      return;
    }
    linkifyUrlEndingAt(quill, cursor);
  });
}

export function linkifySelectionPaste(quill: Quill, url: string): boolean {
  const trimmed = url.trim();
  if (!BARE_URL_RE.test(trimmed)) return false;
  const selection = quill.getSelection();
  if (!selection || selection.length === 0) return false;
  quill.formatText(selection.index, selection.length, "link", trimmed, "user");
  quill.setSelection(selection.index + selection.length, 0, "silent");
  return true;
}

export function linkifyBeforeSubmit(quill: Quill): void {
  linkifyUrlEndingAt(quill, quill.getSelection()?.index ?? quill.getLength());
}
