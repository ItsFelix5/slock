import { service } from "@slock/core/solid";
import { standardEmojiUnicode } from "./emojiSearch";

const emoji = service("emoji");

export function resolvedEmojiName(name: string): boolean {
  return !!standardEmojiUnicode(name) || typeof emoji.source.url(name) === "string";
}
