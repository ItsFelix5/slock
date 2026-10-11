import type { User } from "@slock/types";
import type { createUsersStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    users: ReturnType<typeof createUsersStore>;
  }
}

export function formatInteractorNames(
  ids: string[],
  currentUserId: string | undefined,
  userById: (id: string) => User | undefined,
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
