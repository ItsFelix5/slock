import type { Services } from "@slock/core/types";
import type { FileId } from "@slock/types";
import { createEffect } from "solid-js";

export function titleUntitledPanes(
  panes: Pick<Services["shell.panes"], "panes" | "setPaneContent">,
  canvasTitle: (fileId: FileId) => string | undefined,
) {
  createEffect(
    () =>
      panes.panes().flatMap(({ content, id }) => {
        if (content?.kind !== "canvas" || content.title) return [];
        const title = canvasTitle(content.fileId);
        return title ? [{ fileId: content.fileId, id, title }] : [];
      }),
    (titled) => {
      for (const { fileId, id, title } of titled)
        panes.setPaneContent(id, { fileId, kind: "canvas", title });
    },
  );
}
