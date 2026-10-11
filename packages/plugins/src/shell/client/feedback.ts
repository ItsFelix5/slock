import { createKeyedFeedback, createUndoStack } from "@slock/ui";

export function createFeedback() {
  const { clear, flash, get } = createKeyedFeedback();

  return {
    caught: (key: string, err: unknown, fallbackMessage: string) =>
      flash(key, err instanceof Error ? err.message : fallbackMessage, "error"),
    clear,
    error: (key: string, message: string) => flash(key, message, "error"),
    flash,
    get,
    undo: createUndoStack(),
  };
}
