import type { Reaction } from "@slock/types";

export function addReactionUser(reactions: Reaction[], name: string, userId: string): Reaction[] {
  const existing = reactions.find((reaction) => reaction.name === name);
  if (!existing) return [...reactions, { count: 1, name, users: [userId] }];
  if (existing.users.includes(userId)) return reactions;
  return reactions.map((reaction) =>
    reaction === existing
      ? { ...reaction, count: reaction.count + 1, users: [...reaction.users, userId] }
      : reaction,
  );
}

export function removeReactionUser(
  reactions: Reaction[],
  name: string,
  userId: string,
): Reaction[] {
  const existing = reactions.find((reaction) => reaction.name === name);
  if (!existing?.users.includes(userId)) return reactions;
  return reactions
    .map((reaction) =>
      reaction === existing
        ? {
            ...reaction,
            count: reaction.count - 1,
            users: reaction.users.filter((user) => user !== userId),
          }
        : reaction,
    )
    .filter((reaction) => reaction.count > 0);
}
