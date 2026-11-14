import type { Message } from "@slock/types";

export function reactionMessageKey(channelId: string, ts: string): string {
  return `${channelId}:${ts}`;
}

export function createMessageLocator(
  messagesByChannel: Record<string, Message[]>,
  threadMessages: Record<string, Message[]>,
  reactionMessages: Record<string, Message[]>,
) {
  const threadKeyByTs = new Map<string, string>();
  const containing = (list: Message[] | undefined, ts: string) =>
    list?.some((m) => m.ts === ts) ? list : undefined;
  function findThread(ts: string) {
    const hinted = threadKeyByTs.get(ts);
    const hintedList = hinted === undefined ? undefined : containing(threadMessages[hinted], ts);
    if (hinted !== undefined && hintedList) return { key: hinted, list: hintedList };
    for (const key of Object.keys(threadMessages)) {
      const list = containing(threadMessages[key], ts);
      if (list) {
        if (threadKeyByTs.size > 5000) threadKeyByTs.clear();
        threadKeyByTs.set(ts, key);
        return { key, list };
      }
    }
    threadKeyByTs.delete(ts);
  }
  return function findMessageLocations(
    channelId: string,
    ts: string,
  ): { location: MessageLocation; list: Message[] }[] {
    const results: { location: MessageLocation; list: Message[] }[] = [];
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
  messagesByChannel: Record<string, Message[]>,
  threadMessages: Record<string, Message[]>,
  userId: string,
): number | undefined {
  let latest: number | undefined;
  const scan = (list: Message[] | undefined) => {
    for (const m of list ?? []) {
      if (m.userId !== userId || m.deleted || m.kind !== "normal") continue;
      const ms = Number(m.ts) * 1000;
      if (!latest || ms > latest) latest = ms;
    }
  };
  for (const list of Object.values(messagesByChannel)) scan(list);
  for (const list of Object.values(threadMessages)) scan(list);
  return latest;
}

export type MessageLocation =
  | { store: "channel"; key: string }
  | { store: "thread"; key: string }
  | { store: "reaction"; key: string };
