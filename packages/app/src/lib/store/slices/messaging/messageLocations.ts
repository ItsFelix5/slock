import type { Message } from "@slock/slack-api";
import type { MessageLocation } from "../types";

export function findMessageLocations(
  messagesByChannel: Record<string, Message[]>,
  threadMessages: Record<string, Message[]>,
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
  return results;
}
