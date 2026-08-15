import type { BlockOpResult } from "./blockOps";
import { resolveBlockPosition } from "./containerPath";
import type { Block, DocModel, ListBlock } from "./docModel";
import {
  cloneDoc,
  createCodeBlock,
  createContext,
  createDivider,
  createHeading,
  createList,
  createListItem,
  createParagraph,
  createQuote,
  createTable,
  createTableCell,
  createTableRow,
  createTextRun,
} from "./docModel";
import { containerFlatText, type Range } from "./range";
import { isPipeSeparatorRow, parsePipeRow } from "./shortcuts/tableShortcuts";

/** Flips a checklist item's checked state — `itemPath` is `[...listBlockPath, itemIndex]`. */
export function toggleListItemChecked<A>(doc: DocModel<A>, itemPath: number[]): DocModel<A> | null {
  const listPath = itemPath.slice(0, -1);
  const itemIndex = itemPath[itemPath.length - 1];
  const clone = cloneDoc(doc);
  const pos = resolveBlockPosition(clone.blocks, listPath);
  const block = pos ? pos.array[pos.index] : undefined;
  if (block?.kind !== "list") return null;
  const item = block.items[itemIndex];
  if (!item) return null;
  item.checked = !item.checked;
  return clone;
}

export interface BlockShortcutMatch {
  kind: "heading" | "context" | "quote" | "list" | "codeblock" | "divider";
  level?: number;
  listStyle?: ListBlock<unknown>["style"];
  checked?: boolean;
}

/** Converts the top-level paragraph the caret sits in into the block kind a typed shortcut
 * matched (`detectBlockShortcut`) — only ever fires from a plain, not-yet-converted paragraph. */
export function convertBlockAtCaret<A>(
  doc: DocModel<A>,
  selection: Range,
  match: BlockShortcutMatch,
): BlockOpResult<A> | null {
  const [blockIndex] = selection.focus.path;
  const block = doc.blocks[blockIndex];
  if (block?.kind !== "paragraph") return null;
  const clone = cloneDoc(doc);

  let replacement: Block<A>[];
  switch (match.kind) {
    case "heading":
      replacement = [createHeading<A>(match.level ?? 1, [createTextRun("")])];
      break;
    case "context":
      replacement = [createContext<A>([createTextRun("")])];
      break;
    case "quote":
      replacement = [createQuote<A>([createParagraph<A>()])];
      break;
    case "list":
      replacement = [
        createList<A>(match.listStyle ?? "bullet", [
          createListItem<A>([createTextRun("")], match.checked),
        ]),
      ];
      break;
    case "codeblock":
      replacement = [createCodeBlock("") as Block<A>];
      break;
    case "divider":
      replacement = [createDivider() as Block<A>, createParagraph<A>()];
      break;
  }
  clone.blocks.splice(blockIndex, 1, ...replacement);

  const newPath =
    match.kind === "heading" || match.kind === "context"
      ? [blockIndex, 0]
      : match.kind === "quote" || match.kind === "list"
        ? [blockIndex, 0, 0]
        : match.kind === "codeblock"
          ? [blockIndex]
          : [blockIndex + 1, 0];

  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

/** Enter after completing a `| --- | --- |` separator row, when the paragraph right above it is
 * a `| a | b |` row, turns both into a real table: the pipe-row becomes the header, plus one
 * empty data row underneath — the doc-model half of the typed 3-line table shortcut. */
export function convertPipeRowsToTable<A>(
  doc: DocModel<A>,
  blockIndex: number,
): BlockOpResult<A> | null {
  if (blockIndex < 1) return null;
  const sepBlock = doc.blocks[blockIndex];
  const headerBlock = doc.blocks[blockIndex - 1];
  if (sepBlock?.kind !== "paragraph" || headerBlock?.kind !== "paragraph") return null;
  if (!isPipeSeparatorRow(containerFlatText(sepBlock.runs))) return null;
  const cells = parsePipeRow(containerFlatText(headerBlock.runs));
  if (!cells || cells.length === 0) return null;

  const clone = cloneDoc(doc);
  const headerRow = createTableRow(cells.map((c) => createTableCell<A>([createTextRun(c)])));
  const dataRow = createTableRow(cells.map(() => createTableCell<A>([createTextRun("")])));
  clone.blocks.splice(blockIndex - 1, 2, createTable([headerRow, dataRow]));

  const newPath = [blockIndex - 1, 1, 0, 0];
  return {
    doc: clone,
    selection: { anchor: { offset: 0, path: newPath }, focus: { offset: 0, path: newPath } },
  };
}

export function addTableRow<A>(doc: DocModel<A>, tablePath: number[]): DocModel<A> | null {
  const clone = cloneDoc(doc);
  const pos = resolveBlockPosition(clone.blocks, tablePath);
  const table = pos?.array[pos.index];
  if (table?.kind !== "table") return null;
  const cols = table.rows[0]?.cells.length ?? 0;
  table.rows.push(
    createTableRow(Array.from({ length: cols }, () => createTableCell<A>([createTextRun("")]))),
  );
  return clone;
}

export function addTableColumn<A>(doc: DocModel<A>, tablePath: number[]): DocModel<A> | null {
  const clone = cloneDoc(doc);
  const pos = resolveBlockPosition(clone.blocks, tablePath);
  const table = pos?.array[pos.index];
  if (table?.kind !== "table") return null;
  for (const row of table.rows) row.cells.push(createTableCell<A>([createTextRun("")]));
  return clone;
}
