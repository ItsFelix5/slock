import Quill from "@slock/ui/editor/quill";

export function owningEditor(node: Element): Quill | undefined {
  const container = node.parentElement?.closest(".ql-container");
  const found = container ? Quill.find(container) : null;
  return found instanceof Quill ? found : undefined;
}

// An editor counts as focused while one nested in it is, so `quill.focus()` would not move out.
export function focusAt(quill: Quill, index: number) {
  quill.root.focus({ preventScroll: true });
  quill.setSelection(index, 0);
}

export function removeEmbed(node: Element) {
  const quill = owningEditor(node);
  const blot = Quill.find(node, true);
  if (!(quill && blot) || blot instanceof Quill) return;
  const index = quill.getIndex(blot);
  quill.deleteText(index, 1, "user");
  focusAt(quill, index);
}

export function parentScope(node: Element): string {
  const surface = node.parentElement?.closest<HTMLElement>(".canvas-surface");
  return surface?.dataset.scope ?? "";
}

export function liveOps(quill: Quill | undefined) {
  if (!quill) return;
  quill.update();
  return quill.getContents().ops;
}

export function resizeStep(event: KeyboardEvent): -1 | 0 | 1 {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (step) {
    event.preventDefault();
    event.stopPropagation();
  }
  return step;
}
