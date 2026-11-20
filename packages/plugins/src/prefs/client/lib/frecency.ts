import { isChannelId } from "@slock/slack";
import type { ChannelId, UserPrefs } from "@slock/types";

const FRECENCY_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

function decayScore(count: number, lastTs: number): number {
  return count * 0.5 ** ((Date.now() - lastTs) / FRECENCY_HALF_LIFE_MS);
}

export function frecencyScore(prefs: UserPrefs | undefined, id: string): number {
  const entry = prefs && isChannelId(id) ? prefs.channelFrecency[id] : undefined;
  return entry ? decayScore(entry.count, entry.lastVisit) : 0;
}

export function recentIds(prefs: UserPrefs | undefined): ChannelId[] {
  return Object.entries(prefs?.channelFrecency ?? {})
    .sort(([, a], [, b]) => b.lastVisit - a.lastVisit)
    .flatMap(([id]) => (isChannelId(id) ? [id] : []));
}

export function usedEmojiNames(prefs: UserPrefs | undefined): string[] {
  return Object.keys(prefs?.emojiUse ?? {});
}

export function emojiUseScore(prefs: UserPrefs | undefined, name: string): number {
  return prefs?.emojiUse[name] ?? 0;
}
