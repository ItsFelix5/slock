import type { Message } from "@slock/slack-api";

const PENDING_ID_PREFIX = "pending-";

const PENDING_RECONCILE_WINDOW_MS = 60_000;

export function dedupeMessages(messages: Message[]): Message[] {
  const byTimestamp = new Map<string, Message>();
  for (const message of messages) byTimestamp.set(message.ts, message);
  return [...byTimestamp.values()].sort(
    (a, b) => parseFloat(a.ts || "0") - parseFloat(b.ts || "0") || (a.id < b.id ? -1 : 1),
  );
}

export function mergeMessages(existing: Message[], fresh: Message[]): Message[] {
  const freshById = new Map(fresh.map((m) => [m.id, m]));
  const freshTimestamps = new Set(fresh.map((m) => m.ts));
  const keep = existing.filter((m) => {
    if (freshById.has(m.id) || freshTimestamps.has(m.ts)) return false;
    if (!m.id.startsWith(PENDING_ID_PREFIX)) return true;
    const sentAt = Number(m.id.slice(PENDING_ID_PREFIX.length));
    const reconciled = fresh.some(
      (f) =>
        f.text === m.text &&
        Math.abs(parseFloat(f.ts) * 1000 - sentAt) < PENDING_RECONCILE_WINDOW_MS,
    );
    return !reconciled;
  });
  return dedupeMessages([...keep, ...fresh]);
}
