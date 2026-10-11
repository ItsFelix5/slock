import { customEmojiNames, emojiUrl, standardEmojiEntries } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { fuzzySearch } from "@slock/ui";
import { createMemo } from "solid-js";
import { mergeEmojiEntries } from "../emojiPickerEntries";

const prefsStore = service("prefs");

export interface EmojiEntry {
  name: string;
  searchText: string;
  unicode?: string;
}

const STANDARD_EMOJI_ENTRIES: EmojiEntry[] = standardEmojiEntries().map(
  (e): EmojiEntry => ({
    name: e.name,
    searchText: [e.name, ...e.aliases].join(" ").replace(/[_-]/g, " "),
    unicode: e.unicode,
  }),
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

export function createEmojiIndex() {
  const allEmojiEntries = createMemo(() =>
    mergeEmojiEntries(customEmojiEntries(), STANDARD_EMOJI_ENTRIES),
  );
  const byName = createMemo(() => new Map(allEmojiEntries().map((entry) => [entry.name, entry])));
  const emojiEntryByName = (name: string): EmojiEntry | undefined => byName().get(name);

  function searchEmoji(entries: EmojiEntry[], query: string): EmojiEntry[] {
    if (!query.trim()) return [];
    return fuzzySearch(entries, {
      altText: (e) => e.searchText,
      frequency: (e) => prefsStore.emojiUseScore(e.name),
      query,
      text: (e) => e.name,
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

  return { allEmojiEntries, emojiEntryByName, frequentEmoji, searchEmoji };
}

declare module "@slock/core/types" {
  interface Services {
    emoji: ReturnType<typeof createEmojiIndex>;
  }
}
