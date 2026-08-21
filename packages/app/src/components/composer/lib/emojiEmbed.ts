import { emojiUrl } from "@slock/blockkit";
import Quill from "quill";
import { standardEmojiUnicode } from "../../../lib/emojiSearch";

interface EmojiValue {
  name: string;
}

const Embed = Quill.import("blots/embed") as typeof import("quill/blots/embed").default;

class EmojiBlot extends Embed {
  static blotName = "emoji";
  static tagName = "span";

  static create(value: EmojiValue) {
    const node = super.create(value) as HTMLElement;
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
  if (!value || typeof value !== "object") return;
  const { name } = value as Record<string, unknown>;
  return typeof name === "string" ? name : undefined;
}
