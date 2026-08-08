import { createSignal } from "solid-js";

export interface UndoableAction {
  label: string;
  undo: () => void;
}

// A depth-1 undo stack, not a history — only the single most recent
// undoable action is ever remembered, and firing it (or recording a new
// one) clears the slot rather than leaving something stale for a later
// Ctrl+Z to hit by surprise. Covers actions whose own toggle is already a
// clean inverse (pin, save-for-later, mute), so "undo" is just calling the
// same function again.
export function createUndoSlice() {
  const [lastAction, setLastAction] = createSignal<UndoableAction | null>(null);

  function recordUndoableAction(label: string, undo: () => void) {
    setLastAction({ label, undo });
  }

  function undoLastAction() {
    const action = lastAction();
    if (!action) return;
    setLastAction(null);
    action.undo();
  }

  return { lastAction, recordUndoableAction, undoLastAction };
}
