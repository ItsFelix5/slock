const WORD_BOUNDARY = /[-_\s./]/;

export interface FuzzyMatch {
  score: number;

  tier: number;
}

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

  const span = ti - firstIdx;
  score -= span + lower.length * 0.5;
  return { score, tier: 4 };
}

export interface FuzzySearchOptions<T> {
  altText?: (item: T) => string;

  frequency?: (item: T) => number;

  priority?: (item: T) => number;
  query: string;
  text: (item: T) => string;
}

const ALT_TIER_OFFSET = 10;

export function fuzzySearch<T>(items: readonly T[], opts: FuzzySearchOptions<T>): T[] {
  const q = opts.query.trim().toLowerCase();
  if (!q) return [...items];

  const scored: {
    item: T;
    tier: number;
    score: number;
    pri: number;
    freq: number;
  }[] = [];
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
