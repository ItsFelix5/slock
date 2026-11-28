import { resolveEmojiGlyph } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { CanvasNames } from "./canvasEmbeds";

const emoji = service("emoji");
const titles = service("titles");
const usersStore = service("users");

export function createCanvasNames(): CanvasNames {
  return {
    channel: (id) => titles.title(id),
    controlLabel: (embed) => {
      if (embed.type === "link") return embed.title;
      return embed.type === "file" ? "File" : "Embedded content";
    },
    emojiText: (name) => resolveEmojiGlyph(name, emoji.source) ?? null,
    user: (id) => usersStore.userById(id)?.name ?? id,
  };
}
