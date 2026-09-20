import { indexAlignedText } from "@slock/ui";
import type Quill from "quill";
import { resolvedEmojiName } from "./emojiEmbed";
import { matchTypedEmojiShortcode } from "./textDetection";

export function wireEmojiAutoconvert(quill: Quill): void {
  quill.on("text-change", (_delta, _old, source) => {
    if (source !== "user") return;
    const selection = quill.getSelection();
    if (selection?.length !== 0) return;
    const cursor = selection.index;
    const before = indexAlignedText(quill).slice(0, cursor);
    const match = matchTypedEmojiShortcode(before);
    if (!(match && resolvedEmojiName(match.name))) return;
    quill.deleteText(match.start, match.end - match.start, "api");
    quill.insertEmbed(match.start, "emoji", { name: match.name }, "api");
    quill.setSelection(match.start + 1, 0, "api");
  });
}
