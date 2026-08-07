import type { User } from "@slock/slack-api";

// Shared by ReactionRow's "who reacted" tooltip and ActivityRow's thread-group
// avatar-stack tooltip — both format the same "you, Alice and Bob" list.
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
