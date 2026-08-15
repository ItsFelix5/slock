import { createStore, reconcile } from "solid-js/store";
import {
  addTableColumn as addTableColumnOp,
  addTableRow as addTableRowOp,
  convertBlockAtCaret as convertBlockAtCaretOp,
  convertPipeRowsToTable,
  toggleListItemChecked as toggleListItemCheckedOp,
} from "./blockConvert";
import {
  insertBlockAfterCurrent as insertBlockAfterCurrentOp,
  insertTextInCodeblock,
  mergeWithNextBlock as mergeWithNextBlockOp,
  mergeWithPreviousBlock as mergeWithPreviousBlockOp,
  splitBlockAtCaret as splitBlockAtCaretOp,
} from "./blockOps";
import { resolveRunContainer, setLinkInClone, updateRunTextInClone } from "./containerPath";
import type { DocModel } from "./docModel";
import { cloneDoc, createAtomRun, createTextRun, docToPlainText, emptyDoc } from "./docModel";
import type { CaretContext, EditorHandle } from "./editorHandle";
import { createTextOps } from "./editorTextOps";
import { applyMarkToRange, containerFlatText, deleteRange, type Range } from "./range";

export type { CaretContext, EditorHandle } from "./editorHandle";

const HISTORY_LIMIT = 100;

export function createEditorStore<A = unknown>(): EditorHandle<A> {
  const [doc, setDoc] = createStore<DocModel<A>>(emptyDoc<A>());
  let selection: Range | null = null;
  let root: HTMLElement | undefined;
  let history: DocModel<A>[] = [cloneDoc(doc)];
  let historyIndex = 0;
  const listeners = new Set<() => void>();

  const commit = (next: DocModel<A>) => {
    setDoc(reconcile(next, { key: "id" }));
    for (const cb of listeners) cb();
  };

  const pushHistory = () => {
    history = history.slice(0, historyIndex + 1);
    history.push(cloneDoc(doc));
    if (history.length > HISTORY_LIMIT) history.shift();
    historyIndex = history.length - 1;
  };

  const getCaretContext = (): CaretContext | null => {
    if (!selection) return null;
    const { path, offset } = selection.focus;
    if (path.length === 1) {
      const block = doc.blocks[path[0]];
      if (block?.kind !== "codeblock") return null;
      return { caretOffset: offset, isDocStart: path[0] === 0, text: block.text };
    }
    const containerPath = path.slice(0, -1);
    const runIndex = path[path.length - 1] ?? 0;
    const runs = resolveRunContainer(doc.blocks, containerPath);
    if (!runs) return null;
    return {
      caretOffset: containerFlatText(runs.slice(0, runIndex)).length + offset,
      isDocStart: path[0] === 0 && containerPath.length === 1,
      text: containerFlatText(runs),
    };
  };

  const { replaceTriggerRange, applyLinkToSelection } = createTextOps<A>({
    commit,
    getCaretContext,
    getDoc: () => doc,
    getSelection: () => selection,
    pushHistory,
    setSelection: (range) => {
      selection = range;
    },
  });

  return {
    applyLinkToSelection,

    setLinkAtPath(path, data) {
      const next = setLinkInClone(doc, path, data);
      if (!next) return;
      pushHistory();
      commit(next);
    },

    convertPipeRowsToTableAtCaret() {
      if (!selection) return false;
      const result = convertPipeRowsToTable(doc, selection.focus.path[0]);
      if (!result) return false;
      pushHistory();
      commit(result.doc);
      ({ selection } = result);
      return true;
    },

    addTableRow(tablePath) {
      const next = addTableRowOp(doc, tablePath);
      if (!next) return;
      pushHistory();
      commit(next);
    },

    addTableColumn(tablePath) {
      const next = addTableColumnOp(doc, tablePath);
      if (!next) return;
      pushHistory();
      commit(next);
    },

    convertBlockAtCaret(match) {
      if (!selection) return;
      const result = convertBlockAtCaretOp(doc, selection, match);
      if (!result) return;
      pushHistory();
      commit(result.doc);
      ({ selection } = result);
    },

    insertNewlineInCodeblock() {
      if (!selection) return false;
      const result = insertTextInCodeblock(doc, selection, "\n");
      if (!result) return false;
      pushHistory();
      commit(result.doc);
      ({ selection } = result);
      return true;
    },

    toggleListItemChecked(itemPath) {
      const next = toggleListItemCheckedOp(doc, itemPath);
      if (!next) return;
      pushHistory();
      commit(next);
    },

    clear() {
      pushHistory();
      commit(emptyDoc<A>());
      selection = null;
    },

    deleteSelection() {
      if (!selection) return;
      pushHistory();
      const { doc: next, caret } = deleteRange(doc, selection);
      commit(next);
      selection = { anchor: caret, focus: caret };
    },

    doc,

    focus() {
      root?.focus();
    },

    getCaretContext,

    getDoc: () => doc,

    getPlainText() {
      return docToPlainText(doc);
    },

    getSelection: () => selection,

    insertAtomAtCaret(atomType, data) {
      if (!selection) return;
      const atom = createAtomRun<A>(atomType, data);
      const spaceAfter = createTextRun(" ");
      replaceTriggerRange(getCaretContext()?.caretOffset ?? 0, [atom, spaceAfter]);
    },

    isEmpty() {
      return doc.blocks.length === 1 && doc.blocks[0].kind === "paragraph"
        ? doc.blocks[0].runs.every((r) => r.kind === "text" && r.text === "")
        : doc.blocks.length === 0;
    },

    loadDoc(next) {
      commit(next && next.blocks.length > 0 ? next : emptyDoc<A>());
      history = [cloneDoc(doc)];
      historyIndex = 0;
      selection = null;
    },

    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    pushHistory,

    redo() {
      if (historyIndex >= history.length - 1) return;
      historyIndex += 1;
      commit(structuredClone(history[historyIndex]));
    },

    replaceTriggerRange,

    insertBlockAfterCurrent(block) {
      if (!selection) return;
      pushHistory();
      const result = insertBlockAfterCurrentOp(doc, selection, block);
      commit(result.doc);
      ({ selection } = result);
    },

    mergeWithNextBlock() {
      if (!selection) return false;
      const result = mergeWithNextBlockOp(doc, selection);
      if (!result) return false;
      pushHistory();
      commit(result.doc);
      ({ selection } = result);
      return true;
    },

    mergeWithPreviousBlock() {
      if (!selection) return false;
      const result = mergeWithPreviousBlockOp(doc, selection);
      if (!result) return false;
      pushHistory();
      commit(result.doc);
      ({ selection } = result);
      return true;
    },

    setRoot(el) {
      root = el;
    },

    splitBlockAtCaret() {
      if (!selection) return;
      const result = splitBlockAtCaretOp(doc, selection);
      if (!result) return;
      pushHistory();
      commit(result.doc);
      ({ selection } = result);
    },

    setSelection(range) {
      selection = range;
    },

    toggleMark(mark) {
      if (!selection) return;
      pushHistory();
      commit(applyMarkToRange(doc, selection, mark));
    },

    undo() {
      if (historyIndex <= 0) return;
      historyIndex -= 1;
      commit(structuredClone(history[historyIndex]));
    },

    updateRunText(path, text) {
      // top-level paragraph/heading/context: fine-grained write straight through the store,
      // the DOM already has the correct text (native contenteditable did the edit) so this is
      // just syncing the model to match, without a clone+reconcile round trip. Still notifies
      // listeners (drafts, plainText mirror) same as commit() — only the clone+reconcile is skipped.
      if (path.length === 2) {
        const block = doc.blocks[path[0]];
        const run = block && "runs" in block ? block.runs[path[1]] : undefined;
        if (!run || run.kind === "atom") return;
        // dynamic path across the Block<A> union defeats the store setter's static typing —
        // the runtime guards above already establish this is a text-bearing run.
        (setDoc as (...args: unknown[]) => void)("blocks", path[0], "runs", path[1], "text", text);
        for (const cb of listeners) cb();
        return;
      }
      const next = updateRunTextInClone(doc, path, text);
      if (next) commit(next);
    },
  };
}
