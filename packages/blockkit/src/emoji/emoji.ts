import { nameToEmoji } from "gemoji";

// Every known shortcode alias (e.g. both "+1" and "thumbsup") mapped to its
// unicode glyph, sourced from GitHub's gemoji dataset — the same shortcode
// conventions Slack's own emoji picker originally borrowed from. ~1900 entries,
// vs. the ~140 this used to be hand-maintained as.
const STANDARD_EMOJI: Record<string, string> = nameToEmoji;

// For emoji newer than gemoji's alias table (or ZWJ sequences), Slack falls
// back to naming the shortcode after its raw codepoint(s) in hex, e.g.
// ":1f6dd:" or ":1f9d1-200d-1f4bb:" instead of a friendly name. Slack's
// rich_text "emoji" element's `unicode` field uses this same hex format
// rather than the literal glyph.
const HEX_CODEPOINTS_RE = /^[0-9a-f]{1,6}(-[0-9a-f]{1,6})*$/i;

export function hexCodepointsToEmoji(hex: string): string | undefined {
  if (!HEX_CODEPOINTS_RE.test(hex)) return;
  return String.fromCodePoint(...hex.split("-").map((cp) => parseInt(cp, 16)));
}

export function resolveStandardEmoji(name: string): string | undefined {
  return STANDARD_EMOJI[name] ?? hexCodepointsToEmoji(name);
}
