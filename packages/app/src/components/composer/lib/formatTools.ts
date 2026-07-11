import type { IconName } from "@slock/ui";

export type FormatTool =
  | { kind: "mark"; icon: IconName; title: string; mark: "bold" | "italic" | "strike" | "code" }
  | { kind: "date"; icon: IconName; title: string }
  | { kind: "attach"; icon: IconName; title: string }
  | { kind: "mention"; icon: IconName; title: string };

// Block formats (header, divider, quote, code block, lists) aren't menu items —
// they're typed markdown-style at the start of a line; see maybeApplyLineTrigger.
// Date is the one block that stays in the menu: it needs a real picker popup.
export const FORMAT_TOOLS: FormatTool[] = [
  { kind: "date", icon: "calendar", title: "Date" },
  { kind: "attach", icon: "attachment", title: "Attach file" },
  { kind: "mention", icon: "mentions", title: "Mention someone" },
];

export function createRunTool(opts: {
  applyMark: (mark: "bold" | "italic" | "strike" | "code") => void;
  saveSelection: () => void;
  getFileInput: () => HTMLInputElement | undefined;
  setToolsOpen: (v: boolean) => void;
  setDateOpen: (v: boolean) => void;
  setMentionOpen: (v: boolean) => void;
}) {
  return (tool: FormatTool) => {
    switch (tool.kind) {
      case "mark":
        opts.applyMark(tool.mark);
        opts.setToolsOpen(false);
        return;
      case "date":
        opts.saveSelection();
        opts.setToolsOpen(false);
        opts.setDateOpen(true);
        return;
      case "attach":
        opts.setToolsOpen(false);
        opts.getFileInput()?.click();
        return;
      case "mention":
        opts.saveSelection();
        opts.setToolsOpen(false);
        opts.setMentionOpen(true);
        return;
    }
  };
}
