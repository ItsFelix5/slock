import type { Message } from "@slock/slack-api";

// `fresh` is only ever the latest ~60 messages (a poll snapshot), while `existing`
// may additionally hold older messages paginated in via loadOlderMessages — so this
// must keep anything existing doesn't get an authoritative update for (pending
// stubs and older history alike), not just overwrite wholesale with `fresh`.
export function mergeMessages(existing: Message[], fresh: Message[]): Message[] {
  const freshById = new Map(fresh.map((m) => [m.id, m]));
  const keep = existing.filter((m) => !freshById.has(m.id));
  const merged = [...keep, ...fresh];
  merged.sort(
    (a, b) => parseFloat(a.ts || "0") - parseFloat(b.ts || "0") || (a.id < b.id ? -1 : 1),
  );
  return merged;
}
