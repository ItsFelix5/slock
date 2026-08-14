import type { Mark } from "../docModel";

/** ctrl/cmd+b/i/shift+x → toggle the corresponding mark on the current selection. No keyboard
 * shortcut for underline — Block Kit has no wire representation for it, so it isn't a mark this
 * editor supports at all (see blockkit's `compose/serialize.ts`). */
export function matchMarkShortcutKey(event: KeyboardEvent): Mark | null {
  if (!(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === "b") return "bold";
  if (key === "i") return "italic";
  if (event.shiftKey && key === "x") return "strike";
  return null;
}
