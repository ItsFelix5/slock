// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import {
  mergeEmojiEntries,
  prioritizeEmojiEntries,
} from "../../components/composer/popovers/emoji/emojiPickerEntries";
import type { EmojiEntry } from "../emojiSearch";

const entry = (name: string): EmojiEntry => ({ name, searchText: name });

describe("emoji picker entries", () => {
  test("shows the complete catalog when there is no usage history", () => {
    const entries = [entry("wave"), entry("party")];
    expect(prioritizeEmojiEntries(entries, [])).toEqual(entries);
  });

  test("puts frequent emoji first without duplicating them", () => {
    const entries = [entry("wave"), entry("party"), entry("heart")];
    expect(prioritizeEmojiEntries(entries, [entries[1]])).toEqual([
      entry("party"),
      entry("wave"),
      entry("heart"),
    ]);
  });

  test("lets workspace emoji override standard emoji with the same name", () => {
    expect(mergeEmojiEntries([entry("wave")], [entry("wave"), entry("heart")])).toEqual([
      entry("wave"),
      entry("heart"),
    ]);
  });
});
