import type { Message } from "./api";
import type { MessageLocation } from "./store/slices/types";

export function reactionMessageKey(channelId: string, ts: string): string {
  return `${channelId}:${ts}`;
}

export function findMessageLocations(
  messagesByChannel: Record<string, Message[]>,
  threadMessages: Record<string, Message[]>,
  reactionMessages: Record<string, Message[]>,
  channelId: string,
  ts: string,
): { location: MessageLocation; list: Message[] }[] {
  const results: { location: MessageLocation; list: Message[] }[] = [];
  const inChannel = messagesByChannel[channelId];
  if (inChannel?.some((m) => m.ts === ts))
    results.push({ list: inChannel, location: { key: channelId, store: "channel" } });
  for (const key of Object.keys(threadMessages)) {
    const list = threadMessages[key];
    if (list?.some((m) => m.ts === ts)) results.push({ list, location: { key, store: "thread" } });
  }
  const reactionKey = reactionMessageKey(channelId, ts);
  const reacted = reactionMessages[reactionKey];
  if (reacted?.some((m) => m.ts === ts))
    results.push({ list: reacted, location: { key: reactionKey, store: "reaction" } });
  return results;
}
