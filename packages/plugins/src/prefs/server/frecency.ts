import { isChannelId } from "@slock/slack";

type RawFrecencyEntry = { count?: number; id?: string; visits?: number[] };
type ChannelFrecency = { count: number; id: string; lastVisit: number };

function parse(raw: string | undefined): Record<string, RawFrecencyEntry> | null {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function trimFrecency(prefs: Record<string, string | undefined>): string {
  const jumper =
    parse(prefs.frecency_ent_jumper) ?? parse(prefs.frecency_jumper) ?? parse(prefs.frecency) ?? {};
  const best: Record<string, ChannelFrecency> = {};
  for (const { count = 0, id, visits } of Object.values(jumper)) {
    if (!(id && isChannelId(id))) continue;
    if (id in best && count <= (best[id]?.count ?? 0)) continue;
    best[id] = { count, id, lastVisit: visits?.length ? Math.max(...visits) : 0 };
  }
  return JSON.stringify(best);
}
