import { createSignal } from "solid-js";
import { useShortcut } from "./useShortcut";

export interface UndoEntry {
  label: string;
  undo: () => void | Promise<void>;
}

const MAX_ENTRIES = 30;

export function createUndoStack() {
  const [entries, setEntries] = createSignal<(UndoEntry & { id: number })[]>([]);
  let nextId = 0;

  function push(entry: UndoEntry) {
    const id = nextId++;
    setEntries((prev) => [...prev, { ...entry, id }].slice(-MAX_ENTRIES));
  }

  async function undo(): Promise<string | undefined> {
    const current = entries();
    const last = current[current.length - 1];
    if (!last) return;
    setEntries((prev) => prev.filter((e) => e.id !== last.id));
    await last.undo();
    return last.label;
  }

  return { push, undo };
}

export function useGlobalUndoShortcut(
  stack: ReturnType<typeof createUndoStack>,
  onUndo?: (label: string) => void,
) {
  useShortcut({
    allowInInputs: false,
    allowRepeat: false,
    handler: () => {
      void stack.undo().then((label) => {
        if (label) onUndo?.(label);
      });
    },
    keys: "Ctrl/⌘ Z",
    label: "Undo last action",
    match: (e) =>
      (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z",
    scope: "general",
  });
}
