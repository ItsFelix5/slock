import { DEFAULT_DATE_FORMAT, formatSlackDate } from "@slock/blockkit";

export function createPlainTextEditor(opts: { setText: (value: string) => void }) {
  let el: HTMLTextAreaElement | undefined;
  let savedSelection: [number, number] | undefined;
  let value = "";

  function setRef(next: HTMLTextAreaElement) {
    el = next;
    el.value = value;
  }

  function syncFromDom() {
    if (!el) return;
    const { value: nextValue } = el;
    value = nextValue;
    opts.setText(value);
  }

  function replaceSelection(value: string) {
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.setRangeText(value, start, end, "end");
    syncFromDom();
  }

  function loadDraftIntoEditor(nextValue: string) {
    value = nextValue;
    if (el) el.value = nextValue;
  }

  function clearEditor() {
    value = "";
    if (el) {
      el.value = "";
      el.setSelectionRange(0, 0);
    }
    opts.setText("");
  }

  function applyMark(mark: "bold" | "italic" | "strike" | "code") {
    if (!el) return;
    const marker = mark === "bold" ? "*" : mark === "italic" ? "_" : mark === "strike" ? "~" : "`";
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    el.setRangeText(`${marker}${selected}${marker}`, start, end, "select");
    syncFromDom();
  }

  function insertDateChipAtCaret(timestamp: number, format = DEFAULT_DATE_FORMAT) {
    replaceSelection(`<!date^${timestamp}^${format}|${formatSlackDate(timestamp)}> `);
  }

  function saveSelection() {
    if (el) savedSelection = [el.selectionStart, el.selectionEnd];
  }

  function restoreSelection() {
    el?.focus();
    if (el && savedSelection) el.setSelectionRange(...savedSelection);
  }

  return {
    applyMark,
    clearEditor,
    focusEditor: () => el?.focus(),
    getRef: () => el,
    insertDateChipAtCaret,
    loadDraftIntoEditor,
    replaceSelection,
    restoreSelection,
    saveSelection,
    setRef,
    syncFromDom,
  };
}

export type PlainTextEditor = ReturnType<typeof createPlainTextEditor>;
