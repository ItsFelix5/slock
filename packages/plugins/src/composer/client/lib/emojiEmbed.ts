import { service } from "@slock/core/solid";
import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import { standardEmojiUnicode } from "../../../emoji/client/api/emojiSearch";

const emoji = service("emoji");

interface EmojiValue {
  name: string;
}

class EmojiBlot extends getEmbedBlot() {
  static override blotName = "emoji";
  static override className = "bk-composer-emoji";
  static override tagName = "span";

  static override create(value: EmojiValue) {
    const node = asElement(super.create(value), "emoji");
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
      img.src = emoji.source.url(value.name) ?? "";
      img.alt = `:${value.name}:`;
      node.append(img);
    }
    return node;
  }

  static override value(node: HTMLElement): EmojiValue | undefined {
    const { name } = node.dataset;
    return name ? { name } : undefined;
  }
}

Quill.register(EmojiBlot);
