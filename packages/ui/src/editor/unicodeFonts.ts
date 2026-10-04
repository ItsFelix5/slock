type FontMap = Record<string, string>;

function buildAlphabet(upperBase: number, lowerBase: number, exceptions: FontMap = {}): FontMap {
  const map: FontMap = {};
  for (let i = 0; i < 26; i += 1) {
    const upper = String.fromCharCode(65 + i);
    const lower = String.fromCharCode(97 + i);
    map[upper] = exceptions[upper] ?? String.fromCodePoint(upperBase + i);
    map[lower] = exceptions[lower] ?? String.fromCodePoint(lowerBase + i);
  }
  return map;
}

function buildDigits(base: number): FontMap {
  const map: FontMap = {};
  for (let i = 0; i < 10; i += 1) map[String(i)] = String.fromCodePoint(base + i);
  return map;
}

export const UNICODE_FONTS = {
  cursive: buildAlphabet(0x1d49c, 0x1d4b6, {
    B: "ℬ",
    E: "ℰ",
    F: "ℱ",
    H: "ℋ",
    I: "ℐ",
    L: "ℒ",
    M: "ℳ",
    R: "ℛ",
    e: "ℯ",
    g: "ℊ",
    o: "ℴ",
  }),
  doubleStruck: {
    ...buildAlphabet(0x1d538, 0x1d552, {
      C: "ℂ",
      H: "ℍ",
      N: "ℕ",
      P: "ℙ",
      Q: "ℚ",
      R: "ℝ",
      Z: "ℤ",
    }),
    ...buildDigits(0x1d7d8),
  },
  gothic: buildAlphabet(0x1d504, 0x1d51e, {
    C: "ℭ",
    H: "ℌ",
    I: "ℑ",
    R: "ℜ",
    Z: "ℨ",
  }),
} satisfies Record<string, FontMap>;

export type UnicodeFontKey = keyof typeof UNICODE_FONTS;

function reverseFont(map: FontMap): FontMap {
  return Object.fromEntries(Object.entries(map).map(([plain, fancy]) => [fancy, plain]));
}

export function toggleUnicodeFont(text: string, font: UnicodeFontKey): string {
  const map = UNICODE_FONTS[font];
  const reverse = reverseFont(map);
  const chars = [...text];
  const styleable = chars.filter((ch) => map[ch] || reverse[ch]);
  const alreadyStyled = styleable.length > 0 && styleable.every((ch) => reverse[ch]);
  const table = alreadyStyled ? reverse : map;
  return chars.map((ch) => table[ch] ?? ch).join("");
}
