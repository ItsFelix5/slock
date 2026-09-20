export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightWordsPattern(words: string[]): RegExp | undefined {
  const trimmed = words.map((w) => w.trim()).filter(Boolean);
  if (trimmed.length === 0) return;
  return new RegExp(`\\b(?:${trimmed.map(escapeRegExp).join("|")})\\b`, "gi");
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
