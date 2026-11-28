import { useShortcut } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import { type CanvasCommandContext, runCanvasCommand } from "../lib/canvasCommands";

export function useCanvasSelectionShortcuts(options: {
  canComment: () => boolean;
  contextFor: (quill: Quill) => CanvasCommandContext;
  quill: () => Quill | undefined;
}) {
  const focusedQuill = () => {
    const quill = options.quill();
    return quill?.hasFocus() ? quill : undefined;
  };
  const shared = {
    allowInInputs: true,
    enabled: () => options.canComment() && !!focusedQuill(),
    group: "Canvas",
    scope: "general",
  } as const;
  const run = (name: string) => {
    const quill = focusedQuill();
    if (quill) runCanvasCommand(name, quill, options.contextFor(quill));
  };

  useShortcut({
    ...shared,
    combo: { alt: true, key: "m", mod: true },
    handler: () => run("Comment"),
    id: "canvas.comment",
    label: "Comment on the selection",
  });
  useShortcut({
    ...shared,
    combo: { alt: true, key: "r", mod: true },
    handler: () => run("React"),
    id: "canvas.react",
    label: "React to the selection",
  });

  return run;
}
