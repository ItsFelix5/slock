import { fetchUserPrefs } from "@slock/slack-api";
import { createResource } from "solid-js";
import { createFrecencyTracker, decayScore } from "./frecency";

export function createUsageSlice() {
  const [userPrefs] = createResource(fetchUserPrefs);

  const jumpFrecency = createFrecencyTracker("slock-frecency");
  const recordVisit = jumpFrecency.record;
  // Real jump-list history from Slack (channels *and* people, both keyed by id)
  // plus this session's local tracker, so a fresh browser profile still ranks
  // by actual usage instead of starting empty.
  function frecencyScore(id: string): number {
    const server = userPrefs()?.channelFrecency[id];
    const serverScore = server ? decayScore(server.count, server.lastVisit) : 0;
    return serverScore + jumpFrecency.score(id);
  }

  const emojiFrecency = createFrecencyTracker("slock-emoji-frecency");
  const recordEmojiUse = emojiFrecency.record;
  // Real per-emoji usage counts from Slack (no timestamps are given, so no decay)
  // plus this session's local tracker.
  function emojiUseScore(name: string): number {
    const serverScore = userPrefs()?.emojiUse[name] ?? 0;
    return serverScore + emojiFrecency.score(name);
  }

  return { userPrefs, recordVisit, frecencyScore, recordEmojiUse, emojiUseScore };
}
