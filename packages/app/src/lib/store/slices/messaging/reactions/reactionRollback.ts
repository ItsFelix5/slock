import type { Reaction } from "@slock/slack-api";

export function restoreFailedReaction(
  current: Reaction[] | undefined,
  name: string,
  previous: Reaction | undefined,
  previousIndex: number,
): Reaction[] | undefined {
  const restored = (current ?? []).filter((reaction) => reaction.name !== name);
  if (previous) restored.splice(Math.min(previousIndex, restored.length), 0, previous);
  return restored.length ? restored : undefined;
}
