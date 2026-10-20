import type Quill from "@slock/ui/editor/quill";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import { matchTypedEmojiShortcode } from "./matchTypedEmojiShortcode";
import { resolvedEmojiName } from "./resolvedEmojiName";

export function emojiAutoconvert(quill: Quill): () => void {
  const convert = (_delta: unknown, _old: unknown, source: string) => {
    if (source !== "user") return;
    const selection = quill.getSelection();
    if (selection?.length !== 0) return;
    const before = indexAlignedText(quill).slice(0, selection.index);
    const match = matchTypedEmojiShortcode(before);
    if (!(match && resolvedEmojiName(match.name))) return;
    quill.deleteText(match.start, match.end - match.start, "api");
    quill.insertEmbed(match.start, "emoji", { name: match.name }, "api");
    quill.setSelection(match.start + 1, 0, "api");
  };
  quill.on("text-change", convert);
  return () => quill.off("text-change", convert);
}
