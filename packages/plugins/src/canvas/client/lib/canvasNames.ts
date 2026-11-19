import { resolveStandardEmoji } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { getCachedWorkspaceId } from "@slock/slack";
import type { CanvasNames } from "./canvasEmbeds";

const titles = service("titles");
const usersStore = service("users");

export function createCanvasNames(): CanvasNames {
  return {
    channel: (id) => titles.title(id),
    controlLabel: (embed) => (embed.type === "file" ? "File" : "Embedded content"),
    emojiText: (name) => resolveStandardEmoji(name) ?? null,
    teamId: getCachedWorkspaceId() ?? "",
    user: (id) => usersStore.userById(id)?.name ?? id,
  };
}
