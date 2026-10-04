import { getCachedWorkspaceId } from "@slock/types";
import { standardEmojiUnicode } from "../../components/composer/lib/emojiSearch";
import { channelDisplayName } from "../displayName";
import { store } from "../store";
import type { CanvasNames } from "./canvasEmbeds";

export function createCanvasNames(): CanvasNames {
  return {
    channel: (id) => channelDisplayName(store.channels.channelById(id), id),
    controlLabel: (embed) => {
      if (embed.type === "file") return "File";
      if (embed.type === "video") return "Video";
      return "Embedded content";
    },
    emojiText: (name) => standardEmojiUnicode(name) ?? null,
    teamId: getCachedWorkspaceId() ?? "",
    user: (id) => store.users.userById(id)?.name ?? id,
  };
}
