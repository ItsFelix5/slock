import { isTs } from "@slock/slack";
import type { ChannelId, Message, Ts, UserId } from "@slock/types";
import { tsToMs } from "./tsTime";

export type MessageLocation =
  | { store: "channel"; key: ChannelId }
  | { store: "thread"; key: Ts }
  | { store: "reaction"; key: string };

export type LocatedMessages = { location: MessageLocation; list: Message[] };

const MAX_REMEMBERED_THREADS = 5000;

export function reactionMessageKey(channelId: ChannelId, ts: Ts): string {
  return `${channelId}:${ts}`;
}

export function createMessageLocator(
  messagesByChannel: Record<ChannelId, Message[]>,
  threadMessages: Record<Ts, Message[]>,
  reactionMessages: Record<string, Message[]>,
) {
  const threadKeyByTs = new Map<Ts, Ts>();
  const containing = (list: Message[] | undefined, ts: Ts) =>
    list?.some((m) => m.ts === ts) ? list : undefined;
  function findThread(ts: Ts) {
    const hinted = threadKeyByTs.get(ts);
    const hintedList = hinted === undefined ? undefined : containing(threadMessages[hinted], ts);
    if (hinted !== undefined && hintedList) return { key: hinted, list: hintedList };
    for (const key of Object.keys(threadMessages).filter(isTs)) {
      const list = containing(threadMessages[key], ts);
      if (list) {
        if (threadKeyByTs.size > MAX_REMEMBERED_THREADS) threadKeyByTs.clear();
        threadKeyByTs.set(ts, key);
        return { key, list };
      }
    }
    threadKeyByTs.delete(ts);
  }
  return function findMessageLocations(channelId: ChannelId, ts: Ts): LocatedMessages[] {
    const results: LocatedMessages[] = [];
    const inChannel = containing(messagesByChannel[channelId], ts);
    if (inChannel)
      results.push({ list: inChannel, location: { key: channelId, store: "channel" } });
    const thread = findThread(ts);
    if (thread) results.push({ list: thread.list, location: { key: thread.key, store: "thread" } });
    const reactionKey = reactionMessageKey(channelId, ts);
    const reacted = containing(reactionMessages[reactionKey], ts);
    if (reacted) results.push({ list: reacted, location: { key: reactionKey, store: "reaction" } });
    return results;
  };
}

export function latestMessageTsMsByUser(
  messagesByChannel: Record<ChannelId, Message[]>,
  threadMessages: Record<Ts, Message[]>,
  userId: UserId,
): number | undefined {
  let latest: number | undefined;
  const scan = (list: Message[] | undefined) => {
    for (const m of list ?? []) {
      if (m.userId !== userId || m.deleted || m.kind !== "normal") continue;
      const ms = tsToMs(m.ts);
      if (!latest || ms > latest) latest = ms;
    }
  };
  for (const list of Object.values<Message[]>(messagesByChannel)) scan(list);
  for (const list of Object.values<Message[]>(threadMessages)) scan(list);
  return latest;
}
