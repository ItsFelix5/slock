import { gemoji, type Gemoji } from 'gemoji';

export interface EmojiCategory {
  label: string;
  entries: Gemoji[];
}

// Grouped straight from gemoji's own category field (real Unicode CLDR groups)
// instead of a hand-maintained list — every emoji gemoji knows about is
// guaranteed to appear exactly once, with no manual upkeep required.
export const EMOJI_CATEGORIES: EmojiCategory[] = (() => {
  const order: string[] = [];
  const byCategory = new Map<string, Gemoji[]>();
  for (const entry of gemoji) {
    if (!byCategory.has(entry.category)) {
      order.push(entry.category);
      byCategory.set(entry.category, []);
    }
    byCategory.get(entry.category)!.push(entry);
  }
  return order.map((label) => ({ label, entries: byCategory.get(label)! }));
})();
