import type { Reaction, UserId } from "@slock/types";

export function withReaction(
  reactions: Reaction[],
  name: string,
  userId: UserId,
  reacted: boolean,
): Reaction[] {
  const existing = reactions.find((reaction) => reaction.name === name);
  if (!existing) return reacted ? [...reactions, { count: 1, name, users: [userId] }] : reactions;
  if (existing.users.includes(userId) === reacted) return reactions;
  const users = reacted
    ? [...existing.users, userId]
    : existing.users.filter((user) => user !== userId);
  const count = existing.count + (reacted ? 1 : -1);
  return reactions.flatMap((reaction) => {
    if (reaction !== existing) return [reaction];
    return count > 0 ? [{ ...reaction, count, users }] : [];
  });
}
