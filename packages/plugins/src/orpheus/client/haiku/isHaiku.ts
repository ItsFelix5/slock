import { estimateSyllables } from "./estimateSyllables";
import { humanize } from "./humanize";

const LINE_SIZES = [5, 7, 5];
const WHITESPACE = "[ \\t\\r\\n\\f\\v]";
const UNKEPT = new RegExp(`[^a-zA-Z0-9${WHITESPACE}.$]`, "g");
const WORD_BREAK = new RegExp(`${WHITESPACE}+`);

export function isHaiku(text: string, counts: ReadonlyMap<string, number>) {
  const words = text
    .toLowerCase()
    .replace(UNKEPT, "")
    .replace(/\$/g, "dollar ")
    .replace(/\bise\b/g, "ize")
    .replace(/\d+/g, humanize)
    .split(WORD_BREAK)
    .filter(Boolean);
  const lines = LINE_SIZES.map((size) => ({ size, total: 0 }));
  for (const word of words) {
    const syllables = counts.get(word) ?? estimateSyllables(word);
    const line = lines.find(({ size, total }) => total < size);
    if (!line || line.total + syllables > line.size) return false;
    line.total += syllables;
  }
  return lines.every(({ size, total }) => total === size);
}
