const REGEXP_SPECIAL_RE = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(word: string): string {
  return word.replace(REGEXP_SPECIAL_RE, "\\$&");
}

let cached: { words: string[]; pattern: RegExp | undefined } | undefined;

function buildHighlightWordsPattern(words: string[]): RegExp | undefined {
  if (cached?.words === words) return cached.pattern;
  const source = words
    .map((w) => w.trim())
    .filter(Boolean)
    .map(escapeRegExp)
    .join("|");
  cached = { pattern: source ? new RegExp(`\\b(?:${source})\\b`, "gi") : undefined, words };
  return cached.pattern;
}

export type HighlightSegment = { highlighted: boolean; text: string };

export function splitHighlightWords(text: string, words: string[]): HighlightSegment[] {
  const pattern = buildHighlightWordsPattern(words);
  if (!pattern) return [{ highlighted: false, text }];

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      segments.push({ highlighted: false, text: text.slice(lastIndex, index) });
    segments.push({ highlighted: true, text: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ highlighted: false, text: text.slice(lastIndex) });
  return segments.length > 0 ? segments : [{ highlighted: false, text }];
}
