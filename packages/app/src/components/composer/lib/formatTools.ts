import type { IconName } from "@slock/ui";

export type FormatTool =
  | { kind: "mark"; icon: IconName; title: string; mark: "bold" | "italic" | "strike" | "code" }
  | {
      kind: "block";
      icon: IconName;
      title: string;
      block: "heading" | "quote" | "code" | "bullet" | "number";
    }
  | { kind: "date"; icon: IconName; title: string }
  | { kind: "attach"; icon: IconName; title: string };

export const FORMAT_TOOLS: FormatTool[] = [
  { icon: "bold", kind: "mark", mark: "bold", title: "Bold" },
  { icon: "italic", kind: "mark", mark: "italic", title: "Italic" },
  { icon: "strikethrough", kind: "mark", mark: "strike", title: "Strikethrough" },
  { icon: "code", kind: "mark", mark: "code", title: "Inline code" },
  { block: "heading", icon: "text", kind: "block", title: "Heading" },
  { block: "quote", icon: "quote", kind: "block", title: "Quote" },
  { block: "code", icon: "code", kind: "block", title: "Code block" },
  { block: "bullet", icon: "bulleted-list", kind: "block", title: "Bulleted list" },
  { block: "number", icon: "numbered-list", kind: "block", title: "Numbered list" },
  { icon: "calendar", kind: "date", title: "Date" },
  { icon: "attachment", kind: "attach", title: "Attach file" },
];

export function createRunTool(opts: {
  applyMark: (mark: "bold" | "italic" | "strike" | "code") => void;
  applyBlock: (block: "heading" | "quote" | "code" | "bullet" | "number") => void;
  saveSelection: () => void;
  getFileInput: () => HTMLInputElement | undefined;
  setToolsOpen: (v: boolean) => void;
  setDateOpen: (v: boolean) => void;
}) {
  return (tool: FormatTool) => {
    switch (tool.kind) {
      case "block":
        opts.applyBlock(tool.block);
        opts.setToolsOpen(false);
        return;
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
    }
  };
}
