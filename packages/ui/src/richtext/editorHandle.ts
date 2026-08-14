import type { BlockShortcutMatch } from "./blockConvert";
import type { Block, DocModel, InlineRun, Mark } from "./docModel";
import type { Range } from "./range";

export interface CaretContext {
  text: string;
  caretOffset: number;
  isDocStart: boolean;
}

export interface EditorHandle<A = unknown> {
  doc: DocModel<A>;
  getPlainText(): string;
  getDoc(): DocModel<A>;
  loadDoc(doc: DocModel<A> | undefined): void;
  clear(): void;
  focus(): void;
  isEmpty(): boolean;
  getCaretContext(): CaretContext | null;
  replaceTriggerRange(start: number, runs: InlineRun<A> | InlineRun<A>[]): void;
  insertAtomAtCaret(atomType: string, data: A): void;
  toggleMark(mark: Mark): void;
  deleteSelection(): void;
  onChange(cb: () => void): () => void;
  undo(): void;
  redo(): void;
  pushHistory(): void;
  getSelection(): Range | null;
  setSelection(range: Range | null): void;
  setRoot(el: HTMLElement | undefined): void;
  /** Direct fine-grained write for the common "typed one char into an existing run" case —
   * bypasses the clone+reconcile path since the DOM already has the correct text (native
   * contenteditable did the edit; we're just syncing the model to match). Only paragraph/
   * heading/context (2-segment) paths take this fast path; deeper/shallower paths (codeblock,
   * quote/list nesting) go through a clone+reconcile instead. */
  updateRunText(path: number[], text: string): void;
  splitBlockAtCaret(): void;
  mergeWithPreviousBlock(): boolean;
  mergeWithNextBlock(): boolean;
  insertBlockAfterCurrent(block: Block<A>): void;
  /** Converts the top-level paragraph the caret sits in to a heading/context/quote/list/
   * codeblock/divider — the doc-model half of a typed block shortcut (`## `, `- `, `> `, ...). */
  convertBlockAtCaret(match: BlockShortcutMatch): void;
  /** Enter inside a codeblock inserts a literal newline into its text rather than splitting the
   * block. Returns false (no-op) when the caret isn't in a codeblock. */
  insertNewlineInCodeblock(): boolean;
  toggleListItemChecked(itemPath: number[]): void;
  /** Converts the current (non-collapsed) selection into a single link run, keeping its text as
   * the label — the doc-model half of "pasting a URL over a selection makes it a link". */
  applyLinkToSelection(url: string): void;
  /** Edits an existing link run in place, or (passing `null`) unwraps it back to plain text —
   * the save/remove actions of the click-to-edit popover. */
  setLinkAtPath(path: number[], data: { text: string; url: string } | null): void;
  /** Enter right after completing a `| --- | --- |` row converts it and the pipe-row above it
   * into a real table. Returns false (no-op) when the caret isn't after such a row. */
  convertPipeRowsToTableAtCaret(): boolean;
  addTableRow(tablePath: number[]): void;
  addTableColumn(tablePath: number[]): void;
}
