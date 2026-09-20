import { emojiUrl } from "@slock/blockkit";
import { getEmbedBlot } from "@slock/ui";
import Quill from "quill";
import { standardEmojiUnicode } from "./emojiSearch";

interface EmojiValue {
  name: string;
}

class EmojiBlot extends getEmbedBlot() {
  static blotName = "emoji";
  static tagName = "span";

  static create(value: EmojiValue) {
    const node = super.create(value);
    if (!(node instanceof HTMLElement)) throw new Error("emoji blot produced a non-element node");
    node.className = "bk-composer-emoji";
    node.dataset.name = value.name;
    node.title = `:${value.name}:`;
    const unicode = standardEmojiUnicode(value.name);
    if (unicode) {
      node.classList.add("emoji");
      node.textContent = unicode;
    } else {
      const img = document.createElement("img");
      img.className = "emoji-img";
      img.src = emojiUrl(value.name) ?? "";
      img.alt = `:${value.name}:`;
      node.append(img);
    }
    return node;
  }

  static value(node: HTMLElement): EmojiValue | undefined {
    const { name } = node.dataset;
    return name ? { name } : undefined;
  }
}

Quill.register(EmojiBlot);

export function resolvedEmojiName(name: string): boolean {
  return !!standardEmojiUnicode(name) || typeof emojiUrl(name) === "string";
}

export function emojiValue(value: unknown): string | undefined {
  if (!(value && typeof value === "object" && "name" in value)) return;
  return typeof value.name === "string" ? value.name : undefined;
}
