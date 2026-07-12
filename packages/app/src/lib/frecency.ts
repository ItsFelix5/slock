import type { UserPrefs } from "@slock/slack-api";

// Half-life for the real Slack usage counts pulled from users.prefs.get
// (channelFrecency) — a fresh channel visit outweighs a stale one, but an old
// habit doesn't vanish overnight either.
const FRECENCY_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

function decayScore(count: number, lastTs: number): number {
  return count * 0.5 ** ((Date.now() - lastTs) / FRECENCY_HALF_LIFE_MS);
}

// Real per-conversation usage from Slack's own quick-switcher jump list and
// emoji picker history (users.prefs.get) — entries are keyed by id regardless
// of whether that id is a channel or a person, so this covers both channels
// and DMs/mentions with no separate lookup. No local recording: this app
// never writes back to those prefs, so ranking only moves when the real
// Slack usage data does (i.e. on next fetchUserPrefs).
export function frecencyScore(prefs: UserPrefs | undefined, id: string): number {
  const entry = prefs?.channelFrecency[id];
  return entry ? decayScore(entry.count, entry.lastVisit) : 0;
}

export function emojiUseScore(prefs: UserPrefs | undefined, name: string): number {
  return prefs?.emojiUse[name] ?? 0;
}
