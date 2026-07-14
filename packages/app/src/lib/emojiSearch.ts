import { customEmojiNames, emojiUrl } from "@slock/blockkit";
import { fuzzySearch } from "@slock/ui";
import { EMOJI_CATEGORIES } from "./emojiCategories";
import { store } from "./store";

export interface EmojiEntry {
  category: string;
  name: string;
  searchText: string;
  unicode?: string;
}

const STANDARD_EMOJI_ENTRIES: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((group) =>
  group.entries.map(
    (e): EmojiEntry => ({
      category: group.label,
      name: e.names[0],
      searchText: [...e.names, ...e.tags, e.description].join(" ").toLowerCase(),
      unicode: e.emoji,
    }),
  ),
);

export const EMOJI_CATEGORY_ORDER = ["Custom", ...EMOJI_CATEGORIES.map((g) => g.label)];

const STANDARD_EMOJI_BY_NAME = new Map(STANDARD_EMOJI_ENTRIES.map((e) => [e.name, e.unicode]));

export function standardEmojiUnicode(name: string): string | undefined {
  return STANDARD_EMOJI_BY_NAME.get(name);
}

function customEmojiEntries(): EmojiEntry[] {
  return customEmojiNames()
    .filter((n) => emojiUrl(n))
    .map((name): EmojiEntry => ({ category: "Custom", name, searchText: name }));
}

export function allEmojiEntries(): EmojiEntry[] {
  return [...customEmojiEntries(), ...STANDARD_EMOJI_ENTRIES];
}

// Flat, ungrouped results ranked by name-similarity first (fuzzy, so typos/
// dropped letters still surface) and recent-use frequency as the tiebreaker —
// deliberately not bucketed by category, so a dead-on match doesn't get
// stranded below a closer match in another group. Falls back to aliases/tags/
// description (searchText) when the query only hits those, not the canonical
// `name`.
export function searchEmoji(entries: EmojiEntry[], query: string): EmojiEntry[] {
  if (!query.trim()) return [];
  return fuzzySearch(entries, {
    altText: (e) => e.searchText,
    frequency: (e) => store.preferences.emojiUseScore(e.name),
    query,
    text: (e) => e.name,
  });
}

export function frequentEmoji(entries: EmojiEntry[], limit: number): EmojiEntry[] {
  return entries
    .map((e) => ({ e, score: store.preferences.emojiUseScore(e.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}
