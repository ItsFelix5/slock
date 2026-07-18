import { customEmojiNames, emojiUrl } from "@slock/blockkit";
import { fuzzySearch } from "@slock/ui";
import { EMOJI_CATEGORIES } from "./emojiCategories";
import { store } from "./store";

export interface EmojiEntry {
  name: string;
  searchText: string;
  unicode?: string;
}

const STANDARD_EMOJI_ENTRIES: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((group) =>
  group.entries.map(
    (e): EmojiEntry => ({
      name: e.names[0],
      searchText: [...e.names, ...e.tags, e.description].join(" ").toLowerCase(),
      unicode: e.emoji,
    }),
  ),
);

const STANDARD_EMOJI_BY_NAME = new Map(STANDARD_EMOJI_ENTRIES.map((e) => [e.name, e.unicode]));

export function standardEmojiUnicode(name: string): string | undefined {
  return STANDARD_EMOJI_BY_NAME.get(name);
}

function customEmojiEntries(): EmojiEntry[] {
  return customEmojiNames()
    .filter((n) => emojiUrl(n))
    .map((name): EmojiEntry => ({ name, searchText: name }));
}

export function allEmojiEntries(): EmojiEntry[] {
  return [...customEmojiEntries(), ...STANDARD_EMOJI_ENTRIES];
}

export function searchEmoji(entries: EmojiEntry[], query: string): EmojiEntry[] {
  if (!query.trim()) return [];
  return fuzzySearch(entries, {
    altText: (e) => e.searchText,
    frequency: (e) => store.preferences.emojiUseScore(e.name),
    query,
    text: (e) => e.name,
  });
}

export function frequentEmoji(entries: EmojiEntry[]): EmojiEntry[] {
  return entries
    .map((e) => ({ e, score: store.preferences.emojiUseScore(e.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}
