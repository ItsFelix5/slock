import { defined } from "@slock/core";
import { WHITESPACE_RE } from "@slock/ui";

const EMOJI_SHORTCODE_RE = /:([a-z0-9_+'-]+):$/i;

export function matchTypedEmojiShortcode(
  before: string,
): { start: number; end: number; name: string } | null {
  const match = before.match(EMOJI_SHORTCODE_RE);
  if (!match) return null;
  const [whole, captured] = match;
  const name = defined(captured);
  const start = before.length - whole.length;
  const prevChar = before[start - 1];
  if (prevChar !== undefined && !WHITESPACE_RE.test(prevChar)) return null;
  return { end: before.length, name, start };
}
