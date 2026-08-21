import type Quill from "quill";
import { resolvedEmojiName } from "./emojiEmbed";
import { indexAlignedText } from "./quillMentions";
import { WHITESPACE_RE } from "./textDetection";

const EMOJI_NAME_RE = /:([a-z0-9_+'-]+):$/i;

export function wireEmojiAutoconvert(quill: Quill): void {
  quill.on("text-change", (_delta, _old, source) => {
    if (source !== "user") return;
    const selection = quill.getSelection();
    if (selection?.length !== 0) return;
    const cursor = selection.index;
    const before = indexAlignedText(quill).slice(0, cursor);
    const match = before.match(EMOJI_NAME_RE);
    if (!match) return;
    const [whole, name] = match;
    const start = cursor - whole.length;
    const prevChar = before[start - 1];
    if (prevChar !== undefined && !WHITESPACE_RE.test(prevChar)) return;
    if (!resolvedEmojiName(name)) return;
    quill.deleteText(start, whole.length, "api");
    quill.insertEmbed(start, "emoji", { name }, "api");
    quill.setSelection(start + 1, 0, "api");
  });
}
