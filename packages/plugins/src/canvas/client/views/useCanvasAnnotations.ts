import type Quill from "@slock/ui/editor/quill";
import { isThreadAnnotation } from "../../protocol/api";
import type { CanvasCommentsController } from "../lib/canvasComments";
import { annotateSelection, commentAnchorAt } from "../lib/canvasFormatting";
import type { createCanvasSync } from "../lib/canvasSync";

export function useCanvasAnnotations(options: {
  comments: () => CanvasCommentsController | undefined;
  newId: () => string;
  sync: ReturnType<typeof createCanvasSync>;
}) {
  async function annotationFor(quill: Quill) {
    const existing = commentAnchorAt(quill);
    const id = existing ?? options.newId();
    if (!(existing || annotateSelection(quill, id))) return null;
    await options.sync.flush();
    // The server builds the quote from the saved canvas, so an unsaved anchor cannot be used yet.
    return options.sync.status() === "error" ? null : id;
  }

  function openClicked(target: EventTarget | null): boolean {
    const mark = target instanceof Element ? target.closest("[data-annotation]") : null;
    const id = mark instanceof HTMLElement ? mark.dataset.annotation : undefined;
    const comments = options.comments();
    if (!(id && comments && window.getSelection()?.isCollapsed)) return false;
    if (!comments.markedIds().some((marked) => isThreadAnnotation(id, marked))) return false;
    comments.openAnnotation(id);
    return true;
  }

  return { annotationFor, openClicked };
}
