import type { Block, DocModel, InlineRun, Mark } from "./docModel";
import { cloneDoc, createId, createTextRun } from "./docModel";

/** Addresses a single leaf (a run, or a codeblock's text, or an atomic block) by walking
 * block(/child block/list item/table row+cell)* down to it. `offset` is a char index into
 * that leaf (0 for atom runs and atomic blocks, which can't be partially selected). */
export interface Pos {
  path: number[];
  offset: number;
}

export interface Range {
  anchor: Pos;
  focus: Pos;
}

interface RunLeaf<A> {
  type: "run";
  path: number[];
  runs: InlineRun<A>[];
  index: number;
}
interface TextBlockLeaf {
  type: "codeText";
  path: number[];
  block: Extract<Block, { kind: "codeblock" }>;
  length: number;
}
interface AtomicBlockLeaf<A> {
  type: "atomicBlock";
  path: number[];
  blocks: Block<A>[];
  index: number;
}
type Leaf<A> = RunLeaf<A> | TextBlockLeaf | AtomicBlockLeaf<A>;

function leafLength<A>(leaf: Leaf<A>): number {
  if (leaf.type === "atomicBlock") return 1;
  if (leaf.type === "codeText") return leaf.length;
  const run = leaf.runs[leaf.index];
  return run.kind === "atom" ? 1 : run.text.length;
}

function flattenLeaves<A>(blocks: Block<A>[], prefix: number[] = []): Leaf<A>[] {
  const out: Leaf<A>[] = [];
  blocks.forEach((block, bi) => {
    const path = [...prefix, bi];
    switch (block.kind) {
      case "paragraph":
      case "heading":
      case "context":
        block.runs.forEach((_run, ri) => {
          out.push({ index: ri, path: [...path, ri], runs: block.runs, type: "run" });
        });
        break;
      case "quote":
        out.push(...flattenLeaves(block.children, path));
        break;
      case "list":
        block.items.forEach((item, ii) => {
          item.runs.forEach((_run, ri) => {
            out.push({ index: ri, path: [...path, ii, ri], runs: item.runs, type: "run" });
          });
        });
        break;
      case "table":
        block.rows.forEach((row, rowI) => {
          row.cells.forEach((cell, ci) => {
            cell.runs.forEach((_run, ri) => {
              out.push({ index: ri, path: [...path, rowI, ci, ri], runs: cell.runs, type: "run" });
            });
          });
        });
        break;
      case "codeblock":
        out.push({ block, length: block.text.length, path, type: "codeText" });
        break;
      case "divider":
        out.push({ blocks, index: bi, path, type: "atomicBlock" });
        break;
    }
  });
  return out;
}

/** Concatenates a run-container's text-bearing runs (atoms count as zero-width) up to `flatOffset`
 * characters, and reports which run+char-offset that lands on — the inverse of "flatten this
 * container to plain text and find an index in it", used to translate suggestion-controller
 * trigger offsets (which operate on flat strings) back into doc coordinates. */
export function resolveOffsetInRuns<A>(
  runs: InlineRun<A>[],
  flatOffset: number,
): { runIndex: number; charOffset: number } {
  let remaining = flatOffset;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const len = run.kind === "atom" ? 0 : run.text.length;
    if (remaining <= len) return { charOffset: remaining, runIndex: i };
    remaining -= len;
  }
  const last = runs.length - 1;
  return { charOffset: last >= 0 ? leafTextLength(runs[last]) : 0, runIndex: Math.max(last, 0) };
}

function leafTextLength<A>(run: InlineRun<A>): number {
  return run.kind === "atom" ? 0 : run.text.length;
}

export function containerFlatText<A>(runs: InlineRun<A>[]): string {
  return runs.map((r) => (r.kind === "atom" ? "" : r.text)).join("");
}

export function comparePos(a: Pos, b: Pos): number {
  const len = Math.max(a.path.length, b.path.length);
  for (let i = 0; i < len; i++) {
    const av = a.path[i] ?? -1;
    const bv = b.path[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return a.offset - b.offset;
}

function normalizeRange(range: Range): { start: Pos; end: Pos } {
  return comparePos(range.anchor, range.focus) <= 0
    ? { end: range.focus, start: range.anchor }
    : { end: range.anchor, start: range.focus };
}

export interface RunSpan<A> {
  path: number[];
  run: InlineRun<A>;
  startOffset: number;
  endOffset: number;
}

/** Runs (and pseudo-runs for codeblock text) touched by a range, each annotated with how
 * much of it is covered. Read-only — does not mutate `doc`. */
export function getRunsInRange<A>(doc: DocModel<A>, range: Range): RunSpan<A>[] {
  const { start, end } = normalizeRange(range);
  const leaves = flattenLeaves(doc.blocks);
  const spans: RunSpan<A>[] = [];
  for (const leaf of leaves) {
    if (comparePos({ offset: 0, path: leaf.path }, { offset: 0, path: end.path }) > 0) break;
    const isStart = leaf.path.join(",") === start.path.join(",");
    const isEnd = leaf.path.join(",") === end.path.join(",");
    const afterStart = comparePos({ offset: 0, path: leaf.path }, { offset: 0, path: start.path });
    if (afterStart < 0) continue;
    const length = leafLength(leaf);
    const startOffset = isStart ? start.offset : 0;
    const endOffset = isEnd ? end.offset : length;
    if (startOffset >= endOffset && length > 0) continue;
    if (leaf.type === "run") {
      spans.push({ endOffset, path: leaf.path, run: leaf.runs[leaf.index], startOffset });
    } else if (leaf.type === "codeText") {
      spans.push({
        endOffset,
        path: leaf.path,
        run: createTextRun(leaf.block.text.slice(startOffset, endOffset)),
        startOffset,
      });
    } else {
      spans.push({
        endOffset: 1,
        path: leaf.path,
        run: createTextRun(""),
        startOffset: 0,
      });
    }
    if (isEnd) break;
  }
  return spans;
}

/** Fully-mutates and returns a fresh doc (input is not mutated) with `range` deleted.
 * Scoped simplification: merging across a run-container boundary (paragraph/heading/context/
 * list-item/table-cell) into another run-container is fully supported; a range that starts or
 * ends inside a codeblock/table/divider truncates that leaf in place but does not attempt to
 * merge it with a run-container on the other side of the selection. */
export function deleteRange<A>(doc: DocModel<A>, range: Range): { doc: DocModel<A>; caret: Pos } {
  const clone = cloneDoc(doc);
  const { start, end } = normalizeRange(range);
  const leaves = flattenLeaves(clone.blocks);
  const startLeaf = leaves.find((l) => l.path.join(",") === start.path.join(","));
  const endLeaf = leaves.find((l) => l.path.join(",") === end.path.join(","));
  if (!(startLeaf && endLeaf)) return { caret: start, doc: clone };

  if (startLeaf === endLeaf) {
    deleteWithinLeaf(startLeaf, start.offset, end.offset);
    pruneEmptyAncestors(clone, start.path);
    return { caret: start, doc: clone };
  }

  // truncate the two boundary leaves to what survives
  deleteWithinLeaf(startLeaf, start.offset, leafLength(startLeaf));
  deleteWithinLeaf(endLeaf, 0, end.offset);

  // remove every leaf strictly between start and end from its containing runs array
  for (const leaf of leaves) {
    if (leaf === startLeaf || leaf === endLeaf) continue;
    if (comparePos({ offset: 0, path: leaf.path }, start) <= 0) continue;
    if (comparePos({ offset: 0, path: leaf.path }, end) >= 0) continue;
    if (leaf.type === "run") {
      const idx = leaf.runs.indexOf(leaf.runs[leaf.index]);
      if (idx !== -1) leaf.runs.splice(idx, 1);
    }
  }

  if (startLeaf.type === "run" && endLeaf.type === "run" && startLeaf.runs !== endLeaf.runs) {
    // merge end container's remaining runs into start container, then drop end's (now-empty) container
    startLeaf.runs.push(...endLeaf.runs);
    endLeaf.runs.length = 0;
  }

  removeEmptiedBlocksBetween(clone, start.path, end.path);
  pruneEmptyAncestors(clone, start.path);
  return { caret: start, doc: clone };
}

function deleteWithinLeaf<A>(leaf: Leaf<A>, from: number, to: number): void {
  if (leaf.type === "codeText") {
    leaf.block.text = leaf.block.text.slice(0, from) + leaf.block.text.slice(to);
    return;
  }
  if (leaf.type === "atomicBlock") {
    if (from < 1 && to >= 1) leaf.blocks.splice(leaf.index, 1);
    return;
  }
  const run = leaf.runs[leaf.index];
  if (run.kind === "atom") {
    if (from < 1 && to >= 1) leaf.runs.splice(leaf.index, 1);
    return;
  }
  run.text = run.text.slice(0, from) + run.text.slice(to);
}

/** Removes top-level blocks whose entire run-container became empty as a result of a
 * cross-block delete (e.g. a paragraph that was fully selected and merged elsewhere). */
function removeEmptiedBlocksBetween<A>(
  doc: DocModel<A>,
  start: Pos["path"],
  end: Pos["path"],
): void {
  const startBlockIndex = start[0];
  const endBlockIndex = end[0];
  for (let i = endBlockIndex; i > startBlockIndex; i--) {
    const block = doc.blocks[i];
    if (block && isEmptyBlock(block)) doc.blocks.splice(i, 1);
  }
}

function isEmptyBlock<A>(block: Block<A>): boolean {
  switch (block.kind) {
    case "paragraph":
    case "heading":
    case "context":
      return block.runs.length === 0;
    case "quote":
      return block.children.length === 0;
    case "list":
      return block.items.length === 0;
    case "table":
      return block.rows.length === 0;
    default:
      return false;
  }
}

function pruneEmptyAncestors<A>(_doc: DocModel<A>, _path: Pos["path"]): void {
  // list items / table cells are allowed to hold zero runs (an empty line) — only whole
  // top-level blocks are pruned, handled by removeEmptiedBlocksBetween. Nothing to do here
  // yet; kept as an explicit extension point for when quotes/lists gain deeper nesting.
}

/** Splits any run only partially covered by `range` at the boundary, then toggles `mark`
 * on every fully-covered text/link run (atoms are left untouched — they can't be marked). */
export function applyMarkToRange<A>(doc: DocModel<A>, range: Range, mark: Mark): DocModel<A> {
  const clone = cloneDoc(doc);
  const spans = getRunsInRange(clone, range).filter((s) => s.run.kind !== "atom");
  const allMarked = spans.every((s) => s.run.kind !== "atom" && s.run.marks.includes(mark));
  const target = !allMarked;

  const leaves = flattenLeaves(clone.blocks);
  for (const span of spans) {
    const leaf = leaves.find((l) => l.path.join(",") === span.path.join(","));
    if (leaf?.type !== "run") continue;
    const run = leaf.runs[leaf.index];
    if (run.kind === "atom") continue;
    const full = run.text;
    const before = full.slice(0, span.startOffset);
    const middle = full.slice(span.startOffset, span.endOffset);
    const after = full.slice(span.endOffset);
    const pieces: InlineRun<A>[] = [];
    if (before) pieces.push({ ...run, id: createId(), text: before });
    const marks = target ? [...new Set([...run.marks, mark])] : run.marks.filter((m) => m !== mark);
    pieces.push({ ...run, id: createId(), marks, text: middle });
    if (after) pieces.push({ ...run, id: createId(), text: after });
    leaf.runs.splice(leaf.index, 1, ...pieces);
  }
  return clone;
}
