// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to shortcode detection.
import { emojiUrl } from "@slock/blockkit";
import { standardEmojiUnicode } from "../../../../lib/emojiSearch";
import { createEmojiChip, placeCaretInText } from "../richtext";
import type { EditorRefHandle } from "./editorRef";

// Converts a completed :shortcode: into an emoji chip/unicode char the
// moment the closing colon is typed, mirroring linkifyCommands' "convert as
// soon as it's finished" behavior for URLs. Only looks at the text node the
// caret is in, so it's cheap enough to run on every keystroke.
const SHORTCODE_RE = /(?:^|\s)(:[a-z0-9_+'-]+:)$/i;

export function createEmojiShortcodeCommands(
  ref: EditorRefHandle,
  opts: {
    currentTextContext: () => { node: Text; offset: number } | null;
    syncFromDom: () => void;
  },
) {
  function maybeConvertTypedEmojiShortcode(): boolean {
    const ctx = opts.currentTextContext();
    const el = ref.get();
    if (!(ctx && el?.contains(ctx.node))) return false;
    const { node, offset } = ctx;
    if (node.parentElement?.closest("code, pre")) return false;
    const match = (node.textContent ?? "").slice(0, offset).match(SHORTCODE_RE);
    if (!match) return false;
    const [, raw] = match;
    const name = raw.slice(1, -1);
    const unicode = standardEmojiUnicode(name);
    const url = emojiUrl(name);
    if (!(unicode || url)) return false;

    const after = node.splitText(offset);
    node.deleteData(offset - raw.length, raw.length);
    const parent = node.parentNode;
    if (!parent) return false;
    parent.insertBefore(
      url ? createEmojiChip(name) : document.createTextNode(unicode ?? raw),
      after,
    );
    placeCaretInText(after, 0);
    opts.syncFromDom();
    return true;
  }

  return { maybeConvertTypedEmojiShortcode };
}
