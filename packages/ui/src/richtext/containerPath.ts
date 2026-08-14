import type {
  Block,
  CodeBlock,
  DividerBlock,
  DocModel,
  InlineRun,
  ListBlock,
  RunContainerBlock,
  TableCell,
} from "./docModel";
import { cloneDoc, createId, isRunContainer } from "./docModel";
import type { Range } from "./range";

/** Where a run-container's `runs` array actually lives — either a run-bearing block sitting
 * directly in a `Block<A>[]` array (paragraph/heading/context, possibly nested inside a quote's
 * `children`), a list item's `runs`, or a table cell's `runs`. This is the one abstraction
 * split/merge/backspace are built on, so a quote-nested paragraph and a top-level paragraph share
 * the exact same code path. */
export type ContainerRef<A> =
  | { kind: "blocks"; array: Block<A>[]; index: number }
  | { kind: "listItem"; list: ListBlock<A>; index: number }
  | { kind: "tableCell"; cell: TableCell<A> };

/** Resolves the container a run path points into. `containerPath` is a run `Pos.path` with the
 * trailing run-index dropped. */
export function resolveContainerRef<A>(
  blocks: Block<A>[],
  containerPath: number[],
): ContainerRef<A> | undefined {
  if (containerPath.length === 0) return;
  const [head, ...rest] = containerPath;
  const block = blocks[head];
  if (!block) return;
  if (rest.length === 0) {
    return isRunContainer(block) ? { array: blocks, index: head, kind: "blocks" } : undefined;
  }
  if (block.kind === "quote") return resolveContainerRef(block.children, rest);
  if (block.kind === "list" && rest.length === 1) {
    return block.items[rest[0]] ? { index: rest[0], kind: "listItem", list: block } : undefined;
  }
  if (block.kind === "table" && rest.length === 2) {
    const cell = block.rows[rest[0]]?.cells[rest[1]];
    return cell ? { cell, kind: "tableCell" } : undefined;
  }
}

/** Read-only: the `runs` array a container path points at, regardless of nesting depth. */
export function resolveRunContainer<A>(
  blocks: Block<A>[],
  containerPath: number[],
): InlineRun<A>[] | undefined {
  const ref = resolveContainerRef(blocks, containerPath);
  if (!ref) return;
  if (ref.kind === "blocks") return (ref.array[ref.index] as RunContainerBlock<A>).runs;
  if (ref.kind === "listItem") return ref.list.items[ref.index].runs;
  return ref.cell.runs;
}

/** Finds which `Block<A>[]` array a block-level path (no run index) points into — handles quote
 * nesting, used to find "the block right before this one" for unwrap/eat-divider operations. */
export function resolveBlockPosition<A>(
  blocks: Block<A>[],
  path: number[],
): { array: Block<A>[]; index: number } | undefined {
  if (path.length === 0) return;
  const [head, ...rest] = path;
  if (!blocks[head]) return;
  if (rest.length === 0) return { array: blocks, index: head };
  const block = blocks[head];
  return block.kind === "quote" ? resolveBlockPosition(block.children, rest) : undefined;
}

export function splitRunsAt<A>(
  runs: InlineRun<A>[],
  runIndex: number,
  offset: number,
): { head: InlineRun<A>[]; tail: InlineRun<A>[] } {
  const run = runs[runIndex];
  const headRuns = runs.slice(0, runIndex);
  const tailRuns = runs.slice(runIndex + 1);
  if (run?.kind === "atom") {
    if (offset >= 1) headRuns.push(run);
    else tailRuns.unshift(run);
  } else if (run) {
    const before = run.text.slice(0, offset);
    const after = run.text.slice(offset);
    if (before || headRuns.length === 0) headRuns.push({ ...run, id: createId(), text: before });
    if (after || tailRuns.length === 0) tailRuns.unshift({ ...run, id: createId(), text: after });
  }
  return { head: headRuns, tail: tailRuns };
}

export function caretAt<A>(containerPath: number[], runs: InlineRun<A>[], runIndex: number): Range {
  const run = runs[runIndex];
  const offset = run ? (run.kind === "atom" ? 1 : run.text.length) : 0;
  const path = [...containerPath, Math.max(runIndex, 0)];
  return { anchor: { offset, path }, focus: { offset, path } };
}

export function isAtomicNonRunBlock<A>(
  block: Block<A> | undefined,
): block is DividerBlock | CodeBlock {
  return !!block && (block.kind === "divider" || block.kind === "codeblock");
}

/** The non-hot-path half of `EditorHandle.updateRunText`: codeblock text (path length 1) and
 * nested containers (quote/list, path length >= 3) go through a clone + reconcile so this one
 * function stays correct for every shape, instead of a fine-grained store path per nesting kind. */
export function updateRunTextInClone<A>(
  doc: DocModel<A>,
  path: number[],
  text: string,
): DocModel<A> | null {
  const clone = cloneDoc(doc);
  if (path.length === 1) {
    const block = clone.blocks[path[0]];
    if (block?.kind !== "codeblock") return null;
    block.text = text;
    return clone;
  }
  const containerPath = path.slice(0, -1);
  const runIndex = path[path.length - 1];
  const runs = resolveRunContainer(clone.blocks, containerPath);
  const run = runs?.[runIndex];
  if (!run || run.kind === "atom") return null;
  run.text = text;
  return clone;
}

/** Edits a link run in place, or (`data: null`) unwraps it back into a plain text run. */
export function setLinkInClone<A>(
  doc: DocModel<A>,
  path: number[],
  data: { text: string; url: string } | null,
): DocModel<A> | null {
  const clone = cloneDoc(doc);
  const containerPath = path.slice(0, -1);
  const runIndex = path[path.length - 1];
  const runs = resolveRunContainer(clone.blocks, containerPath);
  const run = runs?.[runIndex];
  if (!runs || run?.kind !== "link") return null;
  if (data === null) {
    runs[runIndex] = { id: run.id, kind: "text", marks: run.marks, text: run.text };
  } else {
    run.text = data.text;
    run.url = data.url;
  }
  return clone;
}
