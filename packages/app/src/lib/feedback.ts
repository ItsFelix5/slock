import { createKeyedFeedback, createUndoStack } from "@slock/ui";

export const actionFeedback = createKeyedFeedback();

export function composerFeedbackKey(key: string): string {
  return `composer:${key}`;
}

export function flashError(key: string, message: string) {
  actionFeedback.flash(key, message, "error");
}

export function flashCaughtError(key: string, err: unknown, fallbackMessage: string) {
  flashError(key, err instanceof Error ? err.message : fallbackMessage);
}

export const undoStack = createUndoStack();
