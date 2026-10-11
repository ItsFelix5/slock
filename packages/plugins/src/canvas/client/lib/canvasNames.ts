import { service } from "@slock/core/solid";
import { getCachedWorkspaceId } from "@slock/slack";
import { standardEmojiUnicode } from "../../../emoji/client/api/emojiSearch";
import type { CanvasNames } from "./canvasEmbeds";

const titles = service("titles");
const usersStore = service("users");

export function createCanvasNames(): CanvasNames {
  return {
    channel: (id) => titles.title(id),
    controlLabel: (embed) => {
      if (embed.type === "file") return "File";
      if (embed.type === "video") return "Video";
      return "Embedded content";
    },
    emojiText: (name) => standardEmojiUnicode(name) ?? null,
    teamId: getCachedWorkspaceId() ?? "",
    user: (id) => usersStore.userById(id)?.name ?? id,
  };
}
