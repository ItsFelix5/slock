import type { EmojiSource } from "./emojiSource";
import emojiData from "./emojis.json" with { type: "json" };

const HEX_CODEPOINTS_RE = /^[0-9a-f]{4,6}(-[0-9a-f]{4,6})*$/i;

export function hexCodepointsToEmoji(hex: string): string | undefined {
  if (!HEX_CODEPOINTS_RE.test(hex)) return;
  const codepoints = hex.split("-").map((cp) => parseInt(cp, 16));
  if (codepoints.some((cp) => cp > 0x10ffff)) return;
  return String.fromCodePoint(...codepoints);
}

interface EmojiRow {
  a?: string;
  n: string;
  s?: Partial<Record<string, string>>;
  u: string;
}

interface StandardEmoji {
  aliases: string[];
  name: string;
  unicode: string;
}

const STANDARD_EMOJI: Record<string, string> = {};

const STANDARD_EMOJI_LIST: StandardEmoji[] = [];
const canonicalByName = new Map<string, StandardEmoji>();
const rows: EmojiRow[] = emojiData;
for (const { a: aliasOf, n: name, s: skins, u: unicode } of rows) {
  const glyph = hexCodepointsToEmoji(unicode);
  if (glyph) {
    STANDARD_EMOJI[name] = glyph;
    if (!aliasOf) {
      const canonical: StandardEmoji = { aliases: [], name, unicode: glyph };
      canonicalByName.set(name, canonical);
      STANDARD_EMOJI_LIST.push(canonical);
    }
  }
  for (const [tone, hex] of Object.entries(skins ?? {})) {
    const variantGlyph = hex && hexCodepointsToEmoji(hex);
    if (variantGlyph) STANDARD_EMOJI[`${name}::skin-tone-${tone}`] = variantGlyph;
  }
}
for (const { a: aliasOf, n: name } of rows) {
  if (aliasOf) canonicalByName.get(aliasOf)?.aliases.push(name);
}

function resolveStandardEmoji(name: string): string | undefined {
  return STANDARD_EMOJI[name.toLowerCase()] ?? hexCodepointsToEmoji(name);
}

export function resolveEmojiGlyph(
  name: string,
  source: Pick<EmojiSource, "aliasTarget">,
): string | undefined {
  const alias = source.aliasTarget(name);
  return resolveStandardEmoji(name) ?? (alias ? resolveStandardEmoji(alias) : undefined);
}

export const EMOJI_TOKEN_RE = /:([a-z0-9_+'-]+(?:::skin-tone-[2-6])?):/gi;

export function standardEmojiEntries(): StandardEmoji[] {
  return STANDARD_EMOJI_LIST;
}
