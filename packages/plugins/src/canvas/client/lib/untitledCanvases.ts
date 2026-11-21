import type { FileId } from "@slock/types";
import type { PaneContent } from "../../../shell/client/api/types";

export interface UntitledCanvas {
  id: string;
  fileId: FileId;
}

export function untitledCanvases(
  panes: readonly { id: string; content: PaneContent | null }[],
): UntitledCanvas[] {
  return panes.flatMap(({ content, id }) =>
    content?.kind === "canvas" && !content.title ? [{ fileId: content.fileId, id }] : [],
  );
}

export function newlyUntitled(
  previous: readonly UntitledCanvas[] | undefined,
  current: readonly UntitledCanvas[],
): UntitledCanvas[] {
  return current.filter(
    (canvas) => !previous?.some((seen) => seen.id === canvas.id && seen.fileId === canvas.fileId),
  );
}
