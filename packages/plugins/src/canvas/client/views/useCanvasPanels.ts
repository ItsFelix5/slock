import type { FileId } from "@slock/types";
import { createResetSignal, useShortcut } from "@slock/ui";

export function useCanvasPanels(options: {
  fileId: () => FileId;
  focused: () => boolean;
  history: { open: () => boolean; setOpen: (open: boolean) => void };
}) {
  const [commentsOpen, setCommentsOpen] = createResetSignal(options.fileId, false);

  function toggleHistory() {
    setCommentsOpen(false);
    options.history.setOpen(!options.history.open());
  }

  function toggleComments() {
    options.history.setOpen(false);
    setCommentsOpen(!commentsOpen());
  }

  const shared = {
    allowInInputs: true,
    enabled: options.focused,
    group: "Canvas",
    scope: "general",
  } as const;
  useShortcut({
    ...shared,
    combo: { alt: true, key: "c", mod: true },
    handler: toggleComments,
    id: "canvas.comments",
    label: "Show the canvas comments",
  });
  useShortcut({
    ...shared,
    combo: { alt: true, key: "h", mod: true },
    handler: toggleHistory,
    id: "canvas.history",
    label: "Show the canvas version history",
  });

  return {
    closeComments: () => setCommentsOpen(false),
    commentsOpen,
    toggleComments,
    toggleHistory,
  };
}
