import {
  type ContainerRef,
  caretAt,
  isAtomicNonRunBlock,
  resolveBlockPosition,
  resolveContainerRef,
  splitRunsAt,
} from "./containerPath";
import type { Block, DocModel, ListBlock, RunContainerBlock } from "./docModel";
import { cloneDoc, createId, createListItem, createParagraph, createTextRun } from "./docModel";
import { containerFlatText, type Range } from "./range";

export interface BlockOpResult<A> {
  doc: DocModel<A>;
  selection: Range;
}

/** Splits the run-container the caret sits in into two of the same kind, at the caret — a real
 * array entry (in whichever array the container lives: top-level blocks, a quote's children, or
 * a list's items), never a synthetic `<br>`. */
export function splitBlockAtCaret<A>(doc: DocModel<A>, selection: Range): BlockOpResult<A> | null {
  const { path, offset } = selection.focus;
  const clone = cloneDoc(doc);
  const containerPath = path.slice(0, -1);
  const runIndex = path[path.length - 1] ?? 0;
  const ref = resolveContainerRef(clone.blocks, containerPath);
  // table cells don't split on Enter — see TableBlockView, Tab/Shift+Tab move between cells
  if (!ref || ref.kind === "tableCell") return null;
  const pathPrefix = containerPath.slice(0, -1);

  if (ref.kind === "listItem" && containerFlatText(ref.list.items[ref.index].runs).length === 0) {
    return exitListOnEmptyItem(clone, pathPrefix, ref);
  }

  const runs =
    ref.kind === "blocks"
      ? (ref.array[ref.index] as RunContainerBlock<A>).runs
      : ref.list.items[ref.index].runs;
  const { head: headRuns, tail: tailRuns } = splitRunsAt(runs, runIndex, offset);

  if (ref.kind === "blocks") {
    const block = ref.array[ref.index] as RunContainerBlock<A>;
    block.runs = headRuns.length ? headRuns : [createTextRun("")];
    const newBlock = {
      ...(block as object),
      id: createId(),
      runs: tailRuns.length ? tailRuns : [createTextRun("")],
    } as Block<A>;
    ref.array.splice(ref.index + 1, 0, newBlock);
  } else {
    const item = ref.list.items[ref.index];
    item.runs = headRuns.length ? headRuns : [createTextRun("")];
    ref.list.items.splice(
      ref.index + 1,
      0,
      createListItem(tailRuns.length ? tailRuns : [createTextRun("")]),
    );
  }

  const newPath = [...pathPrefix, ref.index + 1, 0];
  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

/** Enter on an empty list item exits the list: the item is dropped and a fresh paragraph is
 * inserted where the list (or, mid-list, right after the split-off remainder) sits. */
function exitListOnEmptyItem<A>(
  clone: DocModel<A>,
  pathPrefix: number[],
  ref: Extract<ContainerRef<A>, { kind: "listItem" }>,
): BlockOpResult<A> {
  const listPos = resolveBlockPosition(clone.blocks, pathPrefix);
  const paragraph = createParagraph<A>();
  if (!listPos) {
    ref.list.items.splice(ref.index, 1);
    return { doc: clone, selection: caretAt(pathPrefix, [], 0) };
  }
  const remaining = ref.list.items.slice(ref.index + 1);
  ref.list.items.splice(ref.index, ref.list.items.length - ref.index);
  const insertAt = listPos.index + 1;
  const toInsert: Block<A>[] = [paragraph];
  if (remaining.length > 0) toInsert.push({ ...ref.list, id: createId(), items: remaining });
  if (ref.list.items.length === 0) listPos.array.splice(listPos.index, 1, ...toInsert);
  else listPos.array.splice(insertAt, 0, ...toInsert);
  const paragraphPathPrefix = pathPrefix.slice(0, -1);
  const newBlockIndex = ref.list.items.length === 0 ? listPos.index : insertAt;
  const newPath = [...paragraphPathPrefix, newBlockIndex, 0];
  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

/** Backspace at the very start of a container. Handles: merging into the previous run-container
 * in the same array; eating a divider/codeblock that sits directly before it; unwrapping a list's
 * first item or a quote's sole child out to the level above; and exiting an empty codeblock back
 * to a paragraph. Returns null (no-op — caller lets native contenteditable handle it) otherwise. */
export function mergeWithPreviousBlock<A>(
  doc: DocModel<A>,
  selection: Range,
): BlockOpResult<A> | null {
  const { path, offset } = selection.focus;

  if (path.length === 1) {
    const block = doc.blocks[path[0]];
    if (block?.kind !== "codeblock" || offset !== 0 || block.text.length > 0) return null;
    const clone = cloneDoc(doc);
    clone.blocks.splice(path[0], 1, createParagraph<A>());
    return { doc: clone, selection: caretAt([path[0]], [], 0) };
  }

  const containerPath = path.slice(0, -1);
  const runIndex = path[path.length - 1] ?? 0;
  if (runIndex !== 0 || offset !== 0) return null;
  const ref = resolveContainerRef(doc.blocks, containerPath);
  if (!ref || ref.kind === "tableCell") return null;
  const pathPrefix = containerPath.slice(0, -1);
  const clone = cloneDoc(doc);

  if (ref.kind === "listItem") {
    const { list } = resolveContainerRef(clone.blocks, containerPath) as typeof ref;
    if (ref.index > 0) {
      const prev = list.items[ref.index - 1];
      const cur = list.items[ref.index];
      const boundary = prev.runs.length;
      prev.runs.push(...cur.runs);
      list.items.splice(ref.index, 1);
      return {
        doc: clone,
        selection: caretAt([...pathPrefix, ref.index - 1], prev.runs, boundary),
      };
    }
    return unwrapListFirstItem(clone, pathPrefix, list);
  }

  // ref.kind === "blocks"
  if (ref.index > 0) {
    const arrayPos = resolveBlockPosition(clone.blocks, [...pathPrefix, ref.index]);
    if (!arrayPos) return null;
    const prevBlock = arrayPos.array[arrayPos.index - 1];
    if (isAtomicNonRunBlock(prevBlock)) {
      arrayPos.array.splice(arrayPos.index - 1, 1);
      const newPath = [...pathPrefix, ref.index - 1, 0];
      return {
        doc: clone,
        selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
      };
    }
    if (!(prevBlock && "runs" in prevBlock)) return null;
    const cur = arrayPos.array[arrayPos.index] as RunContainerBlock<A>;
    const boundary = prevBlock.runs.length;
    prevBlock.runs.push(...cur.runs);
    arrayPos.array.splice(arrayPos.index, 1);
    return {
      doc: clone,
      selection: caretAt(
        [...pathPrefix.slice(0, -1), arrayPos.index - 1],
        prevBlock.runs,
        boundary,
      ),
    };
  }
  // first block inside its array — if that array is a quote's children with exactly one child,
  // unwrap the quote entirely; otherwise (top-level, or a multi-child quote) nothing to do.
  if (pathPrefix.length === 0) return null;
  return unwrapSoleQuoteChild(clone, pathPrefix);
}

function unwrapListFirstItem<A>(
  clone: DocModel<A>,
  pathPrefix: number[],
  list: ListBlock<A>,
): BlockOpResult<A> | null {
  const listPos = resolveBlockPosition(clone.blocks, pathPrefix);
  if (!listPos) return null;
  const before = listPos.array[listPos.index - 1];
  const [firstItem] = list.items;
  if (before && "runs" in before) {
    const boundary = before.runs.length;
    before.runs.push(...firstItem.runs);
    list.items.shift();
    if (list.items.length === 0) listPos.array.splice(listPos.index, 1);
    return {
      doc: clone,
      selection: caretAt([...pathPrefix.slice(0, -1), listPos.index - 1], before.runs, boundary),
    };
  }
  // nothing run-bearing before the list — pull the first item out as its own paragraph
  const paragraph = { ...createParagraph<A>(), runs: firstItem.runs };
  list.items.shift();
  listPos.array.splice(listPos.index, list.items.length === 0 ? 1 : 0, paragraph);
  const newPath = [...pathPrefix.slice(0, -1), listPos.index, 0];
  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

function unwrapSoleQuoteChild<A>(
  clone: DocModel<A>,
  pathPrefix: number[],
): BlockOpResult<A> | null {
  const quotePath = pathPrefix.slice(0, -1);
  const quotePos = resolveBlockPosition(clone.blocks, quotePath);
  if (!quotePos) return null;
  const quote = quotePos.array[quotePos.index];
  if (quote.kind !== "quote" || quote.children.length !== 1) return null;
  const [child] = quote.children;
  quotePos.array.splice(quotePos.index, 1, child);
  const newPath = [...quotePath.slice(0, -1), quotePos.index, 0];
  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

/** Delete at the very end of a container — the narrower, symmetric counterpart of
 * `mergeWithPreviousBlock`: merges the next run-container in the same array in, or eats a
 * directly-following divider/codeblock. Cross-structure unwrapping (list/quote) is intentionally
 * not mirrored here — Backspace from the far side already covers exiting those. */
export function mergeWithNextBlock<A>(doc: DocModel<A>, selection: Range): BlockOpResult<A> | null {
  const { path } = selection.focus;
  const containerPath = path.slice(0, -1);
  const ref = resolveContainerRef(doc.blocks, containerPath);
  if (!ref || ref.kind === "tableCell") return null;
  const runs =
    ref.kind === "blocks"
      ? (ref.array[ref.index] as RunContainerBlock<A>).runs
      : ref.list.items[ref.index].runs;
  const flat = containerFlatText(runs);
  const runIndex = path[path.length - 1] ?? 0;
  const focusOffset = containerFlatText(runs.slice(0, runIndex)).length + selection.focus.offset;
  if (focusOffset !== flat.length) return null;
  const pathPrefix = containerPath.slice(0, -1);
  const clone = cloneDoc(doc);

  if (ref.kind === "listItem") {
    const { list } = resolveContainerRef(clone.blocks, containerPath) as typeof ref;
    const cur = list.items[ref.index];
    const next = list.items[ref.index + 1];
    if (!next) return null;
    const boundary = cur.runs.length;
    cur.runs.push(...next.runs);
    list.items.splice(ref.index + 1, 1);
    return { doc: clone, selection: caretAt([...pathPrefix, ref.index], cur.runs, boundary) };
  }

  const arrayPos = resolveBlockPosition(clone.blocks, [...pathPrefix, ref.index]);
  if (!arrayPos) return null;
  const nextBlock = arrayPos.array[arrayPos.index + 1];
  if (isAtomicNonRunBlock(nextBlock)) {
    arrayPos.array.splice(arrayPos.index + 1, 1);
    return { doc: clone, selection: caretAt([...pathPrefix, arrayPos.index], runs, runs.length) };
  }
  if (!(nextBlock && "runs" in nextBlock)) return null;
  const cur = arrayPos.array[arrayPos.index] as RunContainerBlock<A>;
  const boundary = cur.runs.length;
  cur.runs.push(...nextBlock.runs);
  arrayPos.array.splice(arrayPos.index + 1, 1);
  return { doc: clone, selection: caretAt([...pathPrefix, arrayPos.index], cur.runs, boundary) };
}

export function insertBlockAfterCurrent<A>(
  doc: DocModel<A>,
  selection: Range,
  block: Block<A>,
): BlockOpResult<A> {
  const clone = cloneDoc(doc);
  const [blockIndex] = selection.focus.path;
  clone.blocks.splice(blockIndex + 1, 0, block);
  const newPath = [blockIndex + 1, 0];
  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

/** A single character (`\n` for Enter) typed into a codeblock — a plain text splice, never a
 * block split, since a codeblock's content is one opaque string, not runs. */
export function insertTextInCodeblock<A>(
  doc: DocModel<A>,
  selection: Range,
  text: string,
): BlockOpResult<A> | null {
  const { path, offset } = selection.focus;
  if (path.length !== 1) return null;
  const block = doc.blocks[path[0]];
  if (block?.kind !== "codeblock") return null;
  const clone = cloneDoc(doc);
  const cb = clone.blocks[path[0]] as { text: string };
  cb.text = cb.text.slice(0, offset) + text + cb.text.slice(offset);
  const newOffset = offset + text.length;
  const newPath = [path[0]];
  return {
    doc: clone,
    selection: {
      anchor: { offset: newOffset, path: newPath },
      focus: { offset: newOffset, path: newPath },
    },
  };
}
