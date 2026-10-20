import { emojiUrl } from "@slock/blockkit";
import { standardEmojiUnicode } from "./emojiSearch";

export function resolvedEmojiName(name: string): boolean {
  return !!standardEmojiUnicode(name) || typeof emojiUrl(name) === "string";
}
