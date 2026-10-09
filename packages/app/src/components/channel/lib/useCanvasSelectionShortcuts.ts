import { useShortcut } from "@slock/ui";
import type Quill from "quill";
import { type CanvasCommandContext, runCanvasCommand } from "../../../lib/canvas/canvasCommands";

export function useCanvasSelectionShortcuts(options: {
  contextFor: (quill: Quill) => CanvasCommandContext;
  editable: boolean;
  quill: () => Quill | undefined;
}) {
  const focusedQuill = () => {
    const quill = options.quill();
    return quill?.hasFocus() ? quill : undefined;
  };
  const shared = {
    allowInInputs: true,
    enabled: () => options.editable && !!focusedQuill(),
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
