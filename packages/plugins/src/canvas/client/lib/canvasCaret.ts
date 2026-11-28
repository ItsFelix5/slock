import Quill from "@slock/ui/editor/quill";
import { focusAt, owningEditor } from "../views/canvasBlots/embedOwner";

export type Direction = -1 | 1;

function sameRow(quill: Quill, a: number, b: number): boolean {
  return quill.getBounds(a)?.top === quill.getBounds(b)?.top;
}

export function onEdgeRow(quill: Quill, direction: Direction): boolean {
  const range = quill.getSelection();
  return !!range && sameRow(quill, range.index, direction > 0 ? quill.getLength() - 1 : 0);
}

export function placeCaret(quill: Quill, direction: Direction) {
  focusAt(quill, direction > 0 ? 0 : quill.getLength() - 1);
}

function enterBlock(node: Node, direction: Direction): boolean {
  if (!(node instanceof Element)) return false;
  const surfaces = [...node.querySelectorAll(".ql-container")];
  const container = surfaces.at(direction > 0 ? 0 : -1);
  const nested = container ? Quill.find(container) : null;
  if (!(nested instanceof Quill)) return false;
  placeCaret(nested, direction);
  return true;
}

// Quill's own caret movement skips over blocks that hold editors of their own.
export function enterNeighbour(quill: Quill, direction: Direction): boolean {
  const range = quill.getSelection();
  const [line] = range ? quill.getLine(range.index) : [null];
  if (!(range && line)) return false;
  const start = quill.getIndex(line);
  const end = start + line.length() - 1;
  if (!sameRow(quill, range.index, direction > 0 ? end : start)) return false;
  const next = direction > 0 ? end + 1 : start - 1;
  if (next < 0 || next >= quill.getLength()) return false;
  const [neighbour] = quill.getLine(next);
  return !!neighbour && enterBlock(neighbour.domNode, direction);
}

export function leaveBlock(node: Element, direction: Direction) {
  const owner = owningEditor(node);
  const blot = Quill.find(node, true);
  if (!(owner && blot) || blot instanceof Quill) return;
  const index = owner.getIndex(blot);
  const next = direction > 0 ? index + 1 : index - 1;
  if (next < 0 || next >= owner.getLength()) {
    const at = Math.max(next, 0);
    owner.insertText(at, "\n", "user");
    focusAt(owner, at);
    return;
  }
  const [neighbour] = owner.getLine(next);
  if (neighbour && enterBlock(neighbour.domNode, direction)) return;
  focusAt(owner, next);
}
