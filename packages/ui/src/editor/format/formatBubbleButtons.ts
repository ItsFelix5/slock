import type { IconName } from "../../media/Icon";
import type { InlineFormat } from "../editorShortcuts";
import type Quill from "../quill";

export type BubbleButton = { icon: IconName; format: string } & (
  | { kind: "inline"; format: InlineFormat }
  | { kind: "block"; format: "blockquote" | "list"; value: string | true }
  | { kind: "link"; format: "link" }
);

export const BUBBLE_BUTTONS: BubbleButton[] = [
  { format: "bold", icon: "bold", kind: "inline" },
  { format: "italic", icon: "italic", kind: "inline" },
  { format: "strike", icon: "strikethrough", kind: "inline" },
  { format: "code", icon: "code", kind: "inline" },
  { format: "link", icon: "link", kind: "link" },
  { format: "list", icon: "bulleted-list", kind: "block", value: "bullet" },
  { format: "list", icon: "numbered-list", kind: "block", value: "ordered" },
  { format: "blockquote", icon: "quote", kind: "block", value: true },
];

export function isButtonActive(button: BubbleButton, format: Record<string, unknown>) {
  return button.kind === "block" ? format[button.format] === button.value : !!format[button.format];
}

export function toggleBlockFormat(
  quill: Quill,
  button: Extract<BubbleButton, { kind: "block" }>,
  active: boolean,
) {
  const range = quill.getSelection();
  if (range) {
    quill.formatLine(
      range.index,
      range.length,
      button.format,
      active ? false : button.value,
      "user",
    );
  }
}
