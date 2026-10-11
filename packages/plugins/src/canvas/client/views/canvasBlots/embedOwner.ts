import Quill from "quill";

export function owningEditor(node: Element): Quill | undefined {
  const container = node.parentElement?.closest(".ql-container");
  const found = container ? Quill.find(container) : null;
  return found instanceof Quill ? found : undefined;
}

export function removeEmbed(node: Element) {
  const quill = owningEditor(node);
  const blot = Quill.find(node, true);
  if (!(quill && blot && "length" in blot)) return;
  quill.deleteText(quill.getIndex(blot), 1, "user");
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
