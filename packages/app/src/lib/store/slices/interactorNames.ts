import type { User } from "@slock/slack-api";

export function formatInteractorNames(
  ids: string[],
  currentUserId: string | undefined,
  userById: (id: string) => User | undefined,
): string {
  const names = ids.map((id) => (id === currentUserId ? "you" : (userById(id)?.name ?? "someone")));
  return names.reduce(
    (previous, current, index, all) =>
      (previous ? previous + (index < all.length - 1 ? ", " : " and ") : "") + current,
    "",
  );
}
