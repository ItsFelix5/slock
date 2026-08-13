import type { UserPrefs } from "@slock/slack-api";

const FRECENCY_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

function decayScore(count: number, lastTs: number): number {
  return count * 0.5 ** ((Date.now() - lastTs) / FRECENCY_HALF_LIFE_MS);
}

export function frecencyScore(prefs: UserPrefs | undefined, id: string): number {
  const entry = prefs?.channelFrecency[id];
  return entry ? decayScore(entry.count, entry.lastVisit) : 0;
}

export function emojiUseScore(prefs: UserPrefs | undefined, name: string): number {
  return prefs?.emojiUse[name] ?? 0;
}
