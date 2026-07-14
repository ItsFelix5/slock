// Shared fuzzy-match/rank core used by every "type to find X" surface in the
// app (global jump search, @mention/#channel/emoji/slash-command composer
// suggestions, the org-wide people picker, filter comboboxes, the debug icon
// browser). Centralized so every one of these gets the same typo-tolerant
// matching and the same treatment of usage frequency as a tiebreaker, instead
// of each spot growing its own slightly-different substring/prefix filter.

const WORD_BOUNDARY = /[-_\s./]/;

export interface FuzzyMatch {
  // Fine-grained quality within a tier, higher is better.
  score: number;
  // Coarse match quality, lower is better. 0-4 are contiguous matches (exact,
  // prefix, word-boundary substring, mid-word substring); 5 is a non-contiguous
  // subsequence match (e.g. "gnrl" -> "general") kept as a last resort so
  // typos/dropped letters still surface, just ranked behind any real substring hit.
  tier: number;
}

// Case-insensitive match of `query` against `text`. Returns null if `text`
// doesn't contain `query`'s characters in order at all (no match, not just a
// bad one). `query` must already be lowercased+trimmed by the caller.
export function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (!query) return { score: 0, tier: 0 };
  const lower = text.toLowerCase();
  if (lower === query) return { score: 100, tier: 0 };
  if (lower.startsWith(query)) return { score: 100 - lower.length, tier: 1 };
  const idx = lower.indexOf(query);
  if (idx !== -1) {
    const boundary = idx > 0 && WORD_BOUNDARY.test(lower[idx - 1]);
    return { score: 100 - idx, tier: boundary ? 2 : 3 };
  }

  let ti = 0;
  let qi = 0;
  let consecutive = 0;
  let score = 0;
  let firstIdx = -1;
  while (ti < lower.length && qi < query.length) {
    if (lower[ti] === query[qi]) {
      if (firstIdx === -1) firstIdx = ti;
      consecutive++;
      score += 6 + consecutive * 3;
      if (ti === 0 || WORD_BOUNDARY.test(lower[ti - 1])) score += 4;
      qi++;
    } else {
      consecutive = 0;
    }
    ti++;
  }
  if (qi < query.length) return null;
  // Without a length/span penalty, a long haystack (workspaces here have
  // tens of thousands of custom emoji with sentence-length names) can pile up
  // enough word-boundary bonus hits to outscore a tight match in a short,
  // genuinely-relevant name — penalize both how spread out the match was and
  // how long the candidate is overall so short, dense matches win ties.
  const span = ti - firstIdx;
  score -= span + lower.length * 0.5;
  return { score, tier: 4 };
}

export interface FuzzySearchOptions<T> {
  // Secondary text (aliases/tags/description) checked only when `text` doesn't
  // match at all. A hit here always ranks behind every `text` hit, including a
  // fuzzy one, since it's one signal further from what the user is looking at.
  altText?: (item: T) => string;
  // Usage frequency/frecency, higher = used more. Only ever breaks ties
  // between matches of equal tier (and equal priority) — it can't outrank a
  // categorically better text match, but it does decide ordering among
  // near-equal matches, which is most of what a user types.
  frequency?: (item: T) => number;
  // A coarser tiebreak than `frequency`, checked first: groups items within a
  // match tier (e.g. "already a member" vs "just browsing") before frecency
  // decides ordering inside each group. Still can't outrank a better text match.
  priority?: (item: T) => number;
  query: string;
  text: (item: T) => string;
}

const ALT_TIER_OFFSET = 10;

// Ranked, filtered fuzzy search over `items`. Returns only items that matched,
// best match first. Pass the raw query (untrimmed/mixed-case is fine).
export function fuzzySearch<T>(items: readonly T[], opts: FuzzySearchOptions<T>): T[] {
  const q = opts.query.trim().toLowerCase();
  if (!q) return [...items];

  const scored: { item: T; tier: number; score: number; pri: number; freq: number }[] = [];
  for (const item of items) {
    let m = fuzzyMatch(opts.text(item), q);
    if (!m && opts.altText) {
      const alt = fuzzyMatch(opts.altText(item), q);
      if (alt) m = { score: alt.score, tier: alt.tier + ALT_TIER_OFFSET };
    }
    if (!m) continue;
    scored.push({
      freq: opts.frequency?.(item) ?? 0,
      item,
      pri: opts.priority?.(item) ?? 0,
      score: m.score,
      tier: m.tier,
    });
  }

  scored.sort((a, b) => a.tier - b.tier || b.pri - a.pri || b.freq - a.freq || b.score - a.score);
  return scored.map((s) => s.item);
}
