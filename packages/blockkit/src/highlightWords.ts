import { escapeRegExp } from "@slock/core";

const patterns = new WeakMap<string[], RegExp | undefined>();

function buildHighlightWordsPattern(words: string[]): RegExp | undefined {
  if (patterns.has(words)) return patterns.get(words);
  const source = words
    .map((w) => w.trim())
    .filter(Boolean)
    .map(escapeRegExp)
    .join("|");
  const pattern = source ? new RegExp(`\\b(?:${source})\\b`, "gi") : undefined;
  patterns.set(words, pattern);
  return pattern;
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
