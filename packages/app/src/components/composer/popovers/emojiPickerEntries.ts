import type { EmojiEntry } from "../../../lib/emojiSearch";

export function prioritizeEmojiEntries(
  entries: EmojiEntry[],
  ...groups: EmojiEntry[][]
): EmojiEntry[] {
  const seen = new Set<string>();
  const prioritized: EmojiEntry[] = [];
  for (const group of groups) {
    for (const entry of group) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      prioritized.push(entry);
    }
  }
  if (seen.size === 0) return entries;
  return [...prioritized, ...entries.filter((entry) => !seen.has(entry.name))];
}

export function mergeEmojiEntries(custom: EmojiEntry[], standard: EmojiEntry[]): EmojiEntry[] {
  const customNames = new Set(custom.map((entry) => entry.name));
  return [...custom, ...standard.filter((entry) => !customNames.has(entry.name))];
}
