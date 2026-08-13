import emojiData from "./emojis.json" with { type: "json" };

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

const STANDARD_EMOJI_LIST: StandardEmoji[] = [];
const canonicalByName = new Map<string, StandardEmoji>();
const entries = Object.values(emojiData) as EmojiEntry[];
for (const entry of entries) {
  const glyph = hexCodepointsToEmoji(entry.unicode);
  if (glyph) {
    STANDARD_EMOJI[entry.name] = glyph;
    if (!entry.aliasOf) {
      const canonical: StandardEmoji = {
        aliases: [],
        name: entry.name,
        unicode: glyph,
      };
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
