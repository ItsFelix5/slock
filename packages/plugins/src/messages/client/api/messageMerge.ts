import { deepEqual } from "@slock/core";
import type { Message, Ts } from "@slock/types";

const PENDING_ID_PREFIX = "pending-";

const PENDING_RECONCILE_WINDOW_MS = 60_000;

export function isPendingMessage(message: Message): boolean {
  return message.id.startsWith(PENDING_ID_PREFIX);
}

export function confirmsPending(pending: Message, confirmed: Message): boolean {
  if (!isPendingMessage(pending) || isPendingMessage(confirmed)) return false;
  if (pending.userId !== confirmed.userId) return false;
  const sentAt = Number(pending.id.slice(PENDING_ID_PREFIX.length));
  if (Math.abs(parseFloat(confirmed.ts) * 1000 - sentAt) >= PENDING_RECONCILE_WINDOW_MS)
    return false;
  return pending.text === confirmed.text || (!!pending.pendingFiles && !!confirmed.files?.length);
}

export function dedupeMessages(messages: Message[]): Message[] {
  const byTimestamp = new Map<string, Message>();
  for (const message of messages) byTimestamp.set(message.ts, message);
  return [...byTimestamp.values()]
    .map((message) => ({ message, ts: parseFloat(message.ts || "0") }))
    .sort((a, b) => a.ts - b.ts || (a.message.id < b.message.id ? -1 : 1))
    .map(({ message }) => message);
}

export function dropVanished(
  current: Message[],
  known: Message[],
  fresh: Message[],
  covers: (ts: Ts) => boolean,
): Message[] {
  const returned = new Set(fresh.map((m) => m.ts));
  const missing = new Set(known.map((m) => m.ts).filter((ts) => !returned.has(ts) && covers(ts)));
  return current.filter(
    (m) => !missing.has(m.ts) || isPendingMessage(m) || m.deleted || m.isEphemeral,
  );
}

export function mergeMessages(existing: Message[], fresh: Message[]): Message[] {
  const existingByTs = new Map(existing.map((m) => [m.ts, m]));
  const freshById = new Map(fresh.map((m) => [m.id, m]));
  const freshTimestamps = new Set(fresh.map((m) => m.ts));
  const keep = existing.filter((m) => {
    if (freshById.has(m.id) || freshTimestamps.has(m.ts)) return false;
    return !(isPendingMessage(m) && fresh.some((f) => confirmsPending(m, f)));
  });
  const reconciledFresh = fresh.map((m) => {
    const prev = existingByTs.get(m.ts);
    if (!prev) return m;
    if (m.deleted && !prev.deleted) return { ...prev, deleted: true };
    const patched =
      m.isSubscribed === undefined && prev.isSubscribed !== undefined
        ? { ...m, isSubscribed: prev.isSubscribed }
        : m;
    return deepEqual(prev, patched) ? prev : patched;
  });
  return dedupeMessages([...keep, ...reconciledFresh]);
}
