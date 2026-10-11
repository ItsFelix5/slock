import { isRecord } from "@slock/core";
import { apiPost, isRawMessage, mapVisibleMessage } from "@slock/slack";
import type { Message, RawMessage } from "@slock/types";

type MessageIdGroup = { channel: string; timestamps: string[] };
type MessageRef = { channelId: string; ts: string };

const MESSAGES_LIST_BATCH_SIZE = 25;

function chunkMessageIds(messageGroups: MessageIdGroup[]): MessageIdGroup[][] {
  const chunks: MessageIdGroup[][] = [];
  let currentChunk: MessageIdGroup[] = [];
  let currentSize = 0;
  const flushChunk = () => {
    if (currentChunk.length === 0) return;
    chunks.push(currentChunk);
    currentChunk = [];
    currentSize = 0;
  };
  for (const group of messageGroups) {
    for (let i = 0; i < group.timestamps.length; i += MESSAGES_LIST_BATCH_SIZE) {
      const part = {
        channel: group.channel,
        timestamps: group.timestamps.slice(i, i + MESSAGES_LIST_BATCH_SIZE),
      };
      if (currentSize > 0 && currentSize + part.timestamps.length > MESSAGES_LIST_BATCH_SIZE)
        flushChunk();
      currentChunk.push(part);
      currentSize += part.timestamps.length;
    }
  }
  flushChunk();
  return chunks;
}

function rawMessagesFromMessagesListEntry(entry: unknown): RawMessage[] {
  const messages = isRecord(entry) && "messages" in entry ? entry.messages : entry;
  if (Array.isArray(messages)) return messages;
  if (!isRecord(messages)) return [];
  if (isRawMessage(messages)) return [messages];
  return Object.values(messages).filter((value) => isRecord(value) && isRawMessage(value));
}

export async function fetchMessagesByIds(
  entries: MessageRef[],
  onBatch?: (batch: Map<string, Message>) => void,
): Promise<Map<string, Message>> {
  const timestampsByChannel = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = timestampsByChannel.get(entry.channelId) ?? new Set<string>();
    set.add(entry.ts);
    timestampsByChannel.set(entry.channelId, set);
  }
  const byKey = new Map<string, Message>();
  if (timestampsByChannel.size === 0) return byKey;
  const messageGroups = [...timestampsByChannel].map(([channel, timestamps]) => ({
    channel,
    timestamps: [...timestamps],
  }));
  const chunks = chunkMessageIds(messageGroups);
  const resolveChunk = async (messageIds: MessageIdGroup[]): Promise<void> => {
    const data = await apiPost<{ messages?: Record<string, unknown> }>("/api/messages/lookup", {
      messageIds,
    });
    if (!data.ok) {
      if (data.error === "too_many_channels" && messageIds.length > 1) {
        const middle = Math.ceil(messageIds.length / 2);
        await resolveChunk(messageIds.slice(0, middle));
        await resolveChunk(messageIds.slice(middle));
        return;
      }
      throw new Error(data.error ?? "messages.list failed while resolving activity");
    }
    const batch = new Map<string, Message>();
    for (const [channelId, entry] of Object.entries(data.messages ?? {})) {
      for (const raw of rawMessagesFromMessagesListEntry(entry)) {
        const message = mapVisibleMessage(raw);
        if (message) {
          const key = `${channelId}:${raw.ts}`;
          batch.set(key, message);
          byKey.set(key, message);
        }
      }
    }
    onBatch?.(batch);
  };
  const results = await Promise.allSettled(chunks.map(resolveChunk));
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return byKey;
}
