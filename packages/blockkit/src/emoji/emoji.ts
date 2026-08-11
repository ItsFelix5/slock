import emojiData from "./emojis.json" with { type: "json" };

// For emoji whose shortcode isn't in the table below (or that arrive as raw
// ZWJ sequences), Slack falls back to naming the shortcode after its raw
// codepoint(s) in hex, e.g. ":1f6dd:" or ":1f9d1-200d-1f4bb:" instead of a
// friendly name. Slack's rich_text "emoji" element's `unicode` field uses
// this same hex format rather than the literal glyph. Every codepoint in
// Slack's own emoji dataset is zero-padded to 4-6 hex digits, so requiring
// that length keeps ordinary text like "19:50:00" from being misread as a
// codepoint shortcode.
const HEX_CODEPOINTS_RE = /^[0-9a-f]{4,6}(-[0-9a-f]{4,6})*$/i;

export function hexCodepointsToEmoji(hex: string): string | undefined {
  if (!HEX_CODEPOINTS_RE.test(hex)) return;
  const codepoints = hex.split("-").map((cp) => parseInt(cp, 16));
  if (codepoints.some((cp) => cp > 0x10ffff)) return;
  return String.fromCodePoint(...codepoints);
}

interface EmojiEntry {
  aliasOf?: string;
  name: string;
  skinVariations?: Record<string, { name: string; unicode: string }>;
  unicode: string;
}

export interface StandardEmoji {
  aliases: string[];
  name: string;
  unicode: string;
}

const STANDARD_EMOJI: Record<string, string> = {};
// Canonical (non-alias) entries only, for the emoji picker's search list —
// aliases are folded in as extra search terms instead of separate rows.
const STANDARD_EMOJI_LIST: StandardEmoji[] = [];
const canonicalByName = new Map<string, StandardEmoji>();
const entries = Object.values(emojiData) as EmojiEntry[];
for (const entry of entries) {
  const glyph = hexCodepointsToEmoji(entry.unicode);
  if (glyph) {
    STANDARD_EMOJI[entry.name] = glyph;
    if (!entry.aliasOf) {
      const canonical: StandardEmoji = { aliases: [], name: entry.name, unicode: glyph };
      canonicalByName.set(entry.name, canonical);
      STANDARD_EMOJI_LIST.push(canonical);
    }
  }
  for (const variant of Object.values(entry.skinVariations ?? {})) {
    const variantGlyph = hexCodepointsToEmoji(variant.unicode);
    if (variantGlyph) STANDARD_EMOJI[variant.name] = variantGlyph;
  }
}
for (const entry of entries) {
  if (entry.aliasOf) canonicalByName.get(entry.aliasOf)?.aliases.push(entry.name);
}

export function resolveStandardEmoji(name: string): string | undefined {
  return STANDARD_EMOJI[name] ?? hexCodepointsToEmoji(name);
}

export function standardEmojiEntries(): StandardEmoji[] {
  return STANDARD_EMOJI_LIST;
}
