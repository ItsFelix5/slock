import { isRecord } from "@slock/core";
import { service } from "@slock/core/solid";
import { apiPost, isRawMessage, mapVisibleMessage } from "@slock/slack";
import type { Message, RawMessage } from "@slock/types";
import { defineKey } from "../../../query/client/api";
import { createBatchedIdFetcher } from "./cache/batchedIdFetcher";

type MessageIdGroup = { channel: string; timestamps: string[] };
type MessageRef = { channelId: string; ts: string };

const MESSAGES_LIST_BATCH_SIZE = 25;

const query = service("query");
const messageKey = defineKey<[string, string]>("message");

function rawMessagesFromMessagesListEntry(entry: unknown): RawMessage[] {
  const messages = isRecord(entry) && "messages" in entry ? entry.messages : entry;
  if (Array.isArray(messages)) return messages;
  if (!isRecord(messages)) return [];
  if (isRawMessage(messages)) return [messages];
  return Object.values(messages).filter((value) => isRecord(value) && isRawMessage(value));
}

async function lookup(messageIds: MessageIdGroup[]): Promise<Map<string, Message>> {
  const data = await apiPost<{ messages?: Record<string, unknown> }>("/api/messages/lookup", {
    messageIds,
  });
  if (!data.ok) {
    if (data.error === "too_many_channels" && messageIds.length > 1) {
      const middle = Math.ceil(messageIds.length / 2);
      const halves = await Promise.all([
        lookup(messageIds.slice(0, middle)),
        lookup(messageIds.slice(middle)),
      ]);
      return new Map(halves.flatMap((half) => [...half]));
    }
    throw new Error(data.error ?? "messages.list failed while resolving messages");
  }
  const found = new Map<string, Message>();
  for (const [channelId, entry] of Object.entries(data.messages ?? {})) {
    for (const raw of rawMessagesFromMessagesListEntry(entry)) {
      const message = mapVisibleMessage(raw);
      if (message) found.set(`${channelId}:${raw.ts}`, message);
    }
  }
  return found;
}

const fetchBatched = createBatchedIdFetcher<Message | null>(async (keys) => {
  const timestampsByChannel = new Map<string, string[]>();
  for (const key of keys) {
    const [channel = "", ts = ""] = key.split(":");
    timestampsByChannel.set(channel, [...(timestampsByChannel.get(channel) ?? []), ts]);
  }
  const found = await lookup(
    [...timestampsByChannel].map(([channel, timestamps]) => ({ channel, timestamps })),
  );
  return new Map(keys.map((key) => [key, found.get(key) ?? null]));
}, MESSAGES_LIST_BATCH_SIZE);

export async function fetchMessagesByIds(
  entries: MessageRef[],
  onBatch?: (batch: Map<string, Message>) => void,
  fresh = false,
): Promise<Map<string, Message>> {
  const byKey = new Map<string, Message>();
  const refs = new Map(entries.map((entry) => [`${entry.channelId}:${entry.ts}`, entry]));
  await Promise.all(
    [...refs].map(async ([key, { channelId, ts }]) => {
      const message = await query.client.query({
        queryFn: () => fetchBatched(key),
        queryKey: messageKey(channelId, ts),
        staleTime: fresh ? 0 : Number.POSITIVE_INFINITY,
      });
      if (!message) return;
      byKey.set(key, message);
      onBatch?.(new Map([[key, message]]));
    }),
  );
  return byKey;
}
