import type { ActivityItem, Message } from "@slock/slack-api";

// Best-effort: only looks at messages already loaded into the store (the
// channel/thread has been opened this session) — there's no dedicated
// per-message fetch just to populate these badges, so a genuinely-reacted-to
// message you haven't loaded yet just won't show the badge yet.
export function findActivityMessage(
  item: ActivityItem,
  messagesByChannel: Record<string, Message[]>,
  threadMessages: Record<string, Message[]>,
): Message | undefined {
  const inChannel = messagesByChannel[item.channelId]?.find((m) => m.ts === item.ts);
  if (inChannel) return inChannel;
  if (item.threadTs) return threadMessages[item.threadTs]?.find((m) => m.ts === item.ts);
  return undefined;
}

export function hasUserReacted(message: Message | undefined, userId: string | undefined): boolean {
  if (!message?.reactions || !userId) return false;
  return message.reactions.some((r) => r.users.includes(userId));
}

// A thread's root message carries replyUsers (who's replied, per
// conversations.history/replies) independent of whether the full thread is
// loaded — checked first since it's cheaper and more often available than
// scanning threadMessages, which only has data once you've opened the thread.
export function hasUserResponded(
  item: ActivityItem,
  messagesByChannel: Record<string, Message[]>,
  threadMessages: Record<string, Message[]>,
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  const threadTs = item.threadTs ?? (item.kind === "thread_reply" ? item.ts : undefined);
  if (!threadTs) return false;
  const root = messagesByChannel[item.channelId]?.find((m) => m.ts === threadTs);
  if (root?.replyUsers?.includes(userId)) return true;
  return !!threadMessages[threadTs]?.some((m) => m.userId === userId);
}
