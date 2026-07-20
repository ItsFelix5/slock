import type { EditorCommands } from "./editorCommands";

// Cmd/Ctrl+B/I for bold/italic, Cmd/Ctrl+Shift+X/C for strike/code — shared by
// the composer and the canvas editor (CanvasPanel.tsx), since both just
// toggle a mark on the same contentEditable node (see blockCommands.ts's
// applyMark). Returns whether it handled the keypress.
export function handleMarkShortcut(
  e: KeyboardEvent,
  editor: Pick<EditorCommands, "applyMark">,
): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.altKey && !e.shiftKey) {
    if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      editor.applyMark("bold");
      return true;
    }
    if (e.key.toLowerCase() === "i") {
      e.preventDefault();
      editor.applyMark("italic");
      return true;
    }
  }
  if (mod && e.shiftKey && !e.altKey) {
    if (e.key.toLowerCase() === "x") {
      e.preventDefault();
      editor.applyMark("strike");
      return true;
    }
    if (e.key.toLowerCase() === "c") {
      e.preventDefault();
      editor.applyMark("code");
      return true;
    }
  }
  return false;
}
