import { useShortcut } from "@slock/ui";

interface UndoEntry {
  label: string;
  undo: () => void | Promise<void>;
}

const MAX_ENTRIES = 30;

export function createUndoStack() {
  const entries: UndoEntry[] = [];

  function push(entry: UndoEntry) {
    entries.push(entry);
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  async function undo(): Promise<string | undefined> {
    const last = entries.pop();
    if (!last) return;
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
    combo: { key: "z", mod: true },
    handler: () => {
      void stack.undo().then((label) => {
        if (label) onUndo?.(label);
      });
    },
    id: "general.undo",
    label: "Undo last action",
    scope: "general",
    group: "App",
  });
}
