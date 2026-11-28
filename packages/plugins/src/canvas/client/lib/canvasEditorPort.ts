import type Quill from "@slock/ui/editor/quill";
import { Delta, type Op } from "@slock/ui/editor/quill";
import { withoutHistory } from "../views/canvasBlots/embedHistory";
import { applyIdFixes } from "./canvasEditorSetup";
import type { CanvasEditorPort } from "./canvasSync";

const NESTED_SURFACE = ".canvas-surface.nested";

export function createEditorPort(options: {
  active(): Quill | undefined;
  find(scope: string): Quill | undefined;
  onApply(): void;
  root(): Quill | undefined;
  title(): string;
  writeTitle(title: string): void;
}): CanvasEditorPort {
  function replace(root: Quill, ops: Op[]) {
    const change = new Delta(root.getContents().ops).diff(new Delta(ops));
    const active = options.active();
    const nested = active !== root && active?.hasFocus() ? active : undefined;
    const range = nested?.getSelection();
    withoutHistory(root, () => root.updateContents(change, "silent"));
    root.history.transform(change);
    if (range) nested?.setSelection(range, "silent");
  }

  return {
    apply(ops, title) {
      const root = options.root();
      if (root) replace(root, ops);
      options.writeTitle(title);
      options.onApply();
    },
    applyFixes: (fixes) => applyIdFixes(options.find, fixes),
    focusedBlock() {
      const nested = document.activeElement?.closest(NESTED_SURFACE);
      const blocks = [...(options.root()?.root.children ?? [])];
      const block = nested && blocks.find((child) => child.contains(nested));
      return block?.getAttribute("data-sid") ?? null;
    },
    getOps: () => options.root()?.getContents().ops ?? [],
    getTitle: options.title,
    isBusy: () => options.root()?.composition.isComposing ?? true,
  };
}
