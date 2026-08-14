import type { Pos, Range } from "./range";

export function pathKey(path: number[]): string {
  return path.join(",");
}

export function parsePathKey(key: string): number[] {
  return key.split(",").map(Number);
}

/** A click into an empty paragraph/heading/etc lands on the block container, not inside its one
 * (zero-width, since it's empty) run — browsers don't reliably place a caret inside a childless-
 * looking inline element, they fall back to a position in the parent. That resolves to a
 * 1-segment block path instead of the 2+-segment run path the rest of the editor expects.
 * Redirects to the block's first actual run; a block that genuinely has no runs of its own
 * (codeblock, divider) has nothing to redirect to and this is a no-op. */
export function redirectToFirstRun(root: HTMLElement, path: number[]): Pos | null {
  if (path.length !== 1) return null;
  const blockEl = root.querySelector<HTMLElement>(`[data-rt-path="${pathKey(path)}"]`);
  const runEl = blockEl?.querySelector<HTMLElement>("[data-rt-path]");
  if (!runEl) return null;
  return { offset: 0, path: parsePathKey(runEl.dataset.rtPath ?? "") };
}

/** Reads the browser's current Selection (assumed to live inside `root`) into our Pos/Range
 * coordinates via the `data-rt-path` attribute every leaf element renders. */
export function domSelectionToRange(root: HTMLElement, sel: Selection): Range | null {
  if (sel.rangeCount === 0) return null;
  const anchor = domPointToPos(root, sel.anchorNode, sel.anchorOffset);
  const focus = sel.isCollapsed ? anchor : domPointToPos(root, sel.focusNode, sel.focusOffset);
  if (!(anchor && focus)) return null;
  return { anchor, focus };
}

function domPointToPos(root: HTMLElement, node: Node | null, offset: number): Pos | null {
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  const leaf = el?.closest<HTMLElement>("[data-rt-path]");
  if (!(leaf && root.contains(leaf))) return null;
  const path = parsePathKey(leaf.dataset.rtPath ?? "");
  const isAtom = leaf.dataset.rtAtom === "true";
  if (isAtom) {
    // offset within the atom's own children (0 or 1, before/after) maps to a 0/1 leaf offset
    return { offset: node.nodeType === Node.TEXT_NODE ? 0 : Math.min(offset, 1), path };
  }
  return { offset, path };
}

export function rangeToDomSelection(root: HTMLElement, range: Range): void {
  const sel = root.ownerDocument.defaultView?.getSelection();
  if (!sel) return;
  const anchor = posToDomPoint(root, range.anchor);
  const focus = posToDomPoint(root, range.focus);
  if (!(anchor && focus)) return;
  sel.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}

function posToDomPoint(root: HTMLElement, pos: Pos): { node: Node; offset: number } | null {
  const leaf = root.querySelector<HTMLElement>(`[data-rt-path="${pathKey(pos.path)}"]`);
  if (!leaf) return null;
  if (leaf.dataset.rtAtom === "true") return { node: leaf, offset: pos.offset };
  const textNode = leaf.firstChild ?? leaf;
  return { node: textNode, offset: pos.offset };
}

/** One-shot caret placement for the handful of places it must be explicit (shortcut
 * conversions, inserting an atom) — called from a mount `ref` callback on the exact node
 * just created, never from a post-render DOM query. */
export function placeCaretAtTextOffset(textNode: Node, offset: number): void {
  const { ownerDocument } = textNode;
  const sel = ownerDocument?.defaultView?.getSelection();
  if (!(ownerDocument && sel)) return;
  const range = ownerDocument.createRange();
  const len = textNode.textContent?.length ?? 0;
  range.setStart(textNode, Math.min(offset, len));
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function placeCaretAtNodeStart(el: HTMLElement): void {
  const textNode = el.firstChild;
  if (textNode) placeCaretAtTextOffset(textNode, 0);
}

export function placeCaretAfterNode(el: HTMLElement): void {
  const sel = el.ownerDocument.defaultView?.getSelection();
  if (!sel) return;
  const range = el.ownerDocument.createRange();
  range.setStartAfter(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
