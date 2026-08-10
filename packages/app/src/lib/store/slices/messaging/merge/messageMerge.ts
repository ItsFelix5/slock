import type { Message } from "@slock/slack-api";

const PENDING_ID_PREFIX = "pending-";
// A locally-sent message keeps its synthetic id (see sendMessage in
// messages.ts) until either the post's own response or a live gateway echo
// reconciles it to the server's real id — neither of which this function
// waits for. Without matching on text+recency here, an HTTP-fetched page
// (loadRecentHistory/loadOlderMessages/thread replies, or the fallback-poll
// _history_snapshot) that lands in that window dedupes fresh messages by id
// only, so the confirmed copy gets merged in *alongside* the still-pending
// stub — the same message rendered twice at two slightly different
// timestamps/positions.
const PENDING_RECONCILE_WINDOW_MS = 60_000;

export function dedupeMessages(messages: Message[]): Message[] {
  const byTimestamp = new Map<string, Message>();
  for (const message of messages) byTimestamp.set(message.ts, message);
  return [...byTimestamp.values()].sort(
    (a, b) => parseFloat(a.ts || "0") - parseFloat(b.ts || "0") || (a.id < b.id ? -1 : 1),
  );
}

// `fresh` is only ever the latest ~60 messages (a poll snapshot), while `existing`
// may additionally hold older messages paginated in via loadOlderMessages — so this
// must keep anything existing doesn't get an authoritative update for (pending
// stubs and older history alike), not just overwrite wholesale with `fresh`.
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
