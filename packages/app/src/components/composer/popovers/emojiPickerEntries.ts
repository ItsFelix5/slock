import type { EmojiEntry } from "../../../lib/emojiSearch";

export function prioritizeEmojiEntries(
  entries: EmojiEntry[],
  frequent: EmojiEntry[],
): EmojiEntry[] {
  if (frequent.length === 0) return entries;
  const frequentNames = new Set(frequent.map((entry) => entry.name));
  return [...frequent, ...entries.filter((entry) => !frequentNames.has(entry.name))];
}

export function mergeEmojiEntries(custom: EmojiEntry[], standard: EmojiEntry[]): EmojiEntry[] {
  const customNames = new Set(custom.map((entry) => entry.name));
  return [...custom, ...standard.filter((entry) => !customNames.has(entry.name))];
}
