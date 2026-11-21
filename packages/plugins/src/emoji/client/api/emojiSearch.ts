import { type EmojiSource, standardEmojiEntries } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { fuzzySearch } from "@slock/ui";
import { createMemo } from "solid-js";
import { mergeEmojiEntries } from "../emojiPickerEntries";

const prefsStore = service("prefs");

function spaced(text: string): string {
  return text.replace(/[\s_-]+/g, " ");
}

export interface EmojiEntry {
  name: string;
  searchText: string;
  unicode?: string;
}

const STANDARD_EMOJI_ENTRIES: EmojiEntry[] = standardEmojiEntries().map(
  (e): EmojiEntry => ({
    name: e.name,
    searchText: spaced([e.name, ...e.aliases].join(" ")),
    unicode: e.unicode,
  }),
);

const STANDARD_EMOJI_BY_NAME = new Map(STANDARD_EMOJI_ENTRIES.map((e) => [e.name, e.unicode]));

export function standardEmojiUnicode(name: string): string | undefined {
  return STANDARD_EMOJI_BY_NAME.get(name);
}

function customEmojiEntries(source: EmojiSource): EmojiEntry[] {
  return source
    .names()
    .filter((n) => source.url(n))
    .map((name): EmojiEntry => ({ name, searchText: spaced(name) }));
}

export function createEmojiIndex(source: EmojiSource) {
  const allEmojiEntries = createMemo(() =>
    mergeEmojiEntries(customEmojiEntries(source), STANDARD_EMOJI_ENTRIES),
  );
  const byName = createMemo(() => new Map(allEmojiEntries().map((entry) => [entry.name, entry])));
  const emojiEntryByName = (name: string): EmojiEntry | undefined => byName().get(name);

  function searchEmoji(entries: EmojiEntry[], query: string): EmojiEntry[] {
    if (!query.trim()) return [];
    return fuzzySearch(entries, {
      altText: (e) => e.searchText,
      frequency: (e) => prefsStore.emojiUseScore(e.name),
      query: spaced(query),
      text: (e) => spaced(e.name),
    });
  }

  function frequentEmoji(): EmojiEntry[] {
    return prefsStore
      .usedEmojiNames()
      .flatMap((name) => {
        const entry = emojiEntryByName(name);
        const score = prefsStore.emojiUseScore(name);
        return entry && score > 0 ? [{ entry, score }] : [];
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.entry);
  }

  return { allEmojiEntries, emojiEntryByName, frequentEmoji, searchEmoji, source };
}

declare module "@slock/core/types" {
  interface Services {
    emoji: ReturnType<typeof createEmojiIndex>;
  }
}
