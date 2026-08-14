import { unwrap } from "solid-js/store";

export type Mark = "bold" | "italic" | "strike" | "code";

export interface TextRun {
  kind: "text";
  id: string;
  text: string;
  marks: Mark[];
}

export interface LinkRun {
  kind: "link";
  id: string;
  text: string;
  url: string;
  marks: Mark[];
}

export interface AtomRun<A = unknown> {
  kind: "atom";
  id: string;
  atomType: string;
  data: A;
}

export type InlineRun<A = unknown> = TextRun | LinkRun | AtomRun<A>;

export interface ParagraphBlock<A = unknown> {
  kind: "paragraph";
  id: string;
  runs: InlineRun<A>[];
}

export interface HeadingBlock<A = unknown> {
  kind: "heading";
  id: string;
  level: number;
  runs: InlineRun<A>[];
}

export interface ContextBlock<A = unknown> {
  kind: "context";
  id: string;
  runs: InlineRun<A>[];
}

export interface QuoteBlock<A = unknown> {
  kind: "quote";
  id: string;
  children: Block<A>[];
}

export interface CodeBlock {
  kind: "codeblock";
  id: string;
  text: string;
}

export interface DividerBlock {
  kind: "divider";
  id: string;
}

export interface ListItem<A = unknown> {
  id: string;
  runs: InlineRun<A>[];
  checked?: boolean;
}

export interface ListBlock<A = unknown> {
  kind: "list";
  id: string;
  style: "bullet" | "ordered" | "checkbox";
  items: ListItem<A>[];
}

export interface TableCell<A = unknown> {
  id: string;
  runs: InlineRun<A>[];
}

export interface TableRow<A = unknown> {
  id: string;
  cells: TableCell<A>[];
}

export interface TableBlock<A = unknown> {
  kind: "table";
  id: string;
  rows: TableRow<A>[];
}

export type RunContainerBlock<A = unknown> = ParagraphBlock<A> | HeadingBlock<A> | ContextBlock<A>;

export type Block<A = unknown> =
  | ParagraphBlock<A>
  | HeadingBlock<A>
  | ContextBlock<A>
  | QuoteBlock<A>
  | CodeBlock
  | DividerBlock
  | ListBlock<A>
  | TableBlock<A>;

export interface DocModel<A = unknown> {
  blocks: Block<A>[];
}

let idCounter = 0;
export function createId(): string {
  idCounter += 1;
  return `n${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function createTextRun(text: string, marks: Mark[] = []): TextRun {
  return { id: createId(), kind: "text", marks, text };
}

export function createLinkRun(text: string, url: string, marks: Mark[] = []): LinkRun {
  return { id: createId(), kind: "link", marks, text, url };
}

export function createAtomRun<A = unknown>(atomType: string, data: A): AtomRun<A> {
  return { atomType, data, id: createId(), kind: "atom" };
}

export function createParagraph<A = unknown>(
  runs: InlineRun<A>[] = [createTextRun("")],
): ParagraphBlock<A> {
  return { id: createId(), kind: "paragraph", runs };
}

export function createHeading<A = unknown>(level: number, runs: InlineRun<A>[]): HeadingBlock<A> {
  return { id: createId(), kind: "heading", level, runs };
}

export function createContext<A = unknown>(runs: InlineRun<A>[]): ContextBlock<A> {
  return { id: createId(), kind: "context", runs };
}

export function createQuote<A = unknown>(children: Block<A>[]): QuoteBlock<A> {
  return { children, id: createId(), kind: "quote" };
}

export function createCodeBlock(text: string): CodeBlock {
  return { id: createId(), kind: "codeblock", text };
}

export function createDivider(): DividerBlock {
  return { id: createId(), kind: "divider" };
}

export function createListItem<A = unknown>(runs: InlineRun<A>[], checked?: boolean): ListItem<A> {
  return { checked, id: createId(), runs };
}

export function createList<A = unknown>(
  style: ListBlock<A>["style"],
  items: ListItem<A>[],
): ListBlock<A> {
  return { id: createId(), items, kind: "list", style };
}

export function createTableCell<A = unknown>(runs: InlineRun<A>[] = []): TableCell<A> {
  return { id: createId(), runs };
}

export function createTableRow<A = unknown>(cells: TableCell<A>[]): TableRow<A> {
  return { cells, id: createId() };
}

export function createTable<A = unknown>(rows: TableRow<A>[]): TableBlock<A> {
  return { id: createId(), kind: "table", rows };
}

export function emptyDoc<A = unknown>(): DocModel<A> {
  return { blocks: [createParagraph<A>()] };
}

/** structuredClone() throws "Proxy object could not be cloned" on a Solid store directly —
 * unwrap() first to get the plain object it's proxying. Safe to call on already-plain docs too. */
export function cloneDoc<A = unknown>(doc: DocModel<A>): DocModel<A> {
  return structuredClone(unwrap(doc));
}

/** Blocks that hold inline runs directly (no further block-level nesting). */
export function isRunContainer<A>(block: Block<A>): block is RunContainerBlock<A> {
  return block.kind === "paragraph" || block.kind === "heading" || block.kind === "context";
}

export function docToPlainText<A = unknown>(doc: DocModel<A>): string {
  const lines: string[] = [];
  const runsToText = (runs: InlineRun<A>[]) =>
    runs.map((r) => (r.kind === "atom" ? atomFallbackText(r) : r.text)).join("");
  const walk = (blocks: Block<A>[]) => {
    for (const block of blocks) {
      switch (block.kind) {
        case "paragraph":
        case "heading":
        case "context":
          lines.push(runsToText(block.runs));
          break;
        case "quote":
          walk(block.children);
          break;
        case "codeblock":
          lines.push(block.text);
          break;
        case "divider":
          lines.push("---");
          break;
        case "list":
          for (const item of block.items) lines.push(runsToText(item.runs));
          break;
        case "table":
          for (const row of block.rows)
            lines.push(row.cells.map((c) => runsToText(c.runs)).join(" | "));
          break;
      }
    }
  };
  walk(doc.blocks);
  return lines.join("\n");
}

function atomFallbackText<A>(run: AtomRun<A>): string {
  const data = run.data as Record<string, unknown> | undefined;
  if (typeof data?.fallbackText === "string") return data.fallbackText;
  return "";
}
