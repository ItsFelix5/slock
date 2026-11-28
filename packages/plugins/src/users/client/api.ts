import { service } from "@slock/core/solid";
import { defineQuery } from "@slock/plugins/query/client/api";
import { isChannelId, isUserId } from "@slock/slack";
import type { User, UserId } from "@slock/types";
import type { createUsersStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    users: ReturnType<typeof createUsersStore>;
  }
}

const users = service("users");
const titles = service("titles");

const MENTION_RE = /<([#@])([A-Z0-9]+)(?:\|([^>]*))?>/g;

export function mentionText(text: string): string {
  return text.replace(MENTION_RE, (token, sigil: string, id: string, label?: string) => {
    if (sigil === "#" && isChannelId(id)) return label ? `#${label}` : titles.label(id);
    if (sigil === "@" && isUserId(id)) return `@${users.userById(id)?.name ?? (label || id)}`;
    return token;
  });
}

export const userMatches = defineQuery<string, User[]>({
  load: (term) => users.searchUsers(term),
  maxAgeMs: 30_000,
  name: "userMatches",
  revalidates: false,
});

export function formatInteractorNames(
  ids: UserId[],
  currentUserId: UserId | undefined,
  userById: (id: UserId) => User | undefined,
  max = ids.length,
): string {
  const names = ids.map((id) => (id === currentUserId ? "you" : (userById(id)?.name ?? "someone")));
  const shownCount = names.length - max === 1 ? names.length : max;
  const shown = names.slice(0, shownCount);
  const hidden = names.length - shownCount;
  if (hidden > 0) shown.push(`${hidden} others`);
  if (shown.length < 2) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}
