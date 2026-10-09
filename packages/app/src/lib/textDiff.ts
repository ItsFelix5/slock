import { EMOJI_TOKEN_RE } from "@slock/blockkit";

export interface DiffSegment {
  kind: "same" | "added" | "removed";
  text: string;
}

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let last = 0;
  const pushPlain = (plain: string) => {
    for (const { segment } of wordSegmenter.segment(plain)) tokens.push(segment);
  };
  for (const match of text.matchAll(EMOJI_TOKEN_RE)) {
    const index = match.index ?? 0;
    pushPlain(text.slice(last, index));
    tokens.push(match[0]);
    last = index + match[0].length;
  }
  pushPlain(text.slice(last));
  return tokens;
}

function pushSegment(segments: DiffSegment[], kind: DiffSegment["kind"], text: string) {
  const tail = segments.at(-1);
  if (tail?.kind === kind) tail.text += text;
  else segments.push({ kind, text });
}

export function diffText(before: string, after: string): DiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pushSegment(segments, "same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) pushSegment(segments, "removed", a[i++]);
    else pushSegment(segments, "added", b[j++]);
  }
  while (i < a.length) pushSegment(segments, "removed", a[i++]);
  while (j < b.length) pushSegment(segments, "added", b[j++]);
  return segments;
}
