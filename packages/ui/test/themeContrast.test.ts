import { describe, expect, test } from "bun:test";
import { cssColorToOklch, type OklchColor } from "../src/form/oklchColor";
import { BUILTIN_THEME_COLORS } from "../src/themeColorBuiltins";
import { parseColorRef } from "../src/themeDerivations";
import { THEME_PRESETS, type ThemePreset } from "../src/themePresets";

type Rgb = [number, number, number];

const MAX_DEPTH = 12;

function resolve(preset: ThemePreset, key: string, depth = 0): OklchColor {
  if (depth > MAX_DEPTH) throw new Error(`${preset.id}: reference cycle at ${key}`);
  const raw = preset.colors[key] ?? BUILTIN_THEME_COLORS.find((def) => def.key === key)?.derive;
  if (raw === undefined) throw new Error(`${preset.id}: ${key} has no value`);
  const ref = parseColorRef(raw);
  if (!ref) return cssColorToOklch(raw);
  const source = resolve(preset, ref.source, depth + 1);
  return {
    alpha: ref.alpha === undefined ? source.alpha : ref.alpha / 100,
    chroma: Math.max(0, source.chroma + (ref.deltaC ?? 0) / 100),
    hue: source.hue,
    lightness: Math.min(1, Math.max(0, source.lightness + (ref.deltaL ?? 0) / 100)),
  };
}

function toSrgb({ lightness, chroma, hue }: OklchColor): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };
  return [encode(linear[0] ?? 0), encode(linear[1] ?? 0), encode(linear[2] ?? 0)];
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function flatten(color: OklchColor, base: Rgb): Rgb {
  const [r, g, b] = toSrgb(color);
  return [
    r * color.alpha + base[0] * (1 - color.alpha),
    g * color.alpha + base[1] * (1 - color.alpha),
    b * color.alpha + base[2] * (1 - color.alpha),
  ];
}

function contrast(preset: ThemePreset, foreground: string, background: string): number {
  const page = toSrgb(resolve(preset, "mainBg"));
  const backRgb = flatten(resolve(preset, background), page);
  const frontRgb = flatten(resolve(preset, foreground), backRgb);
  const [x, y] = [luminance(frontRgb), luminance(backRgb)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const readable: [string, string, number][] = [
  ["textPrimary", "mainBg", 7],
  ["textPrimary", "sidebarBg", 4.5],
  ["textSecondary", "mainBg", 4.5],
  ["textDim", "mainBg", 3],
  ["textOnAccent", "accent", 4.5],
  ["accent", "mainBg", 3],
  ["linkColor", "mainBg", 4.5],
  ["danger", "mainBg", 3],
  ["warning", "mainBg", 3],
  ["textPrimary", "codeBg", 4.5],
];

describe("theme presets", () => {
  test("every preset resolves every color without cycles or gaps", () => {
    for (const preset of THEME_PRESETS) {
      for (const { key } of BUILTIN_THEME_COLORS) expect(() => resolve(preset, key)).not.toThrow();
    }
  });

  test("preset ids are unique and each dark or light scheme matches its background", () => {
    expect(new Set(THEME_PRESETS.map((preset) => preset.id)).size).toBe(THEME_PRESETS.length);
    for (const preset of THEME_PRESETS) {
      const { lightness } = resolve(preset, "mainBg");
      expect(lightness > 0.6).toBe(preset.colorScheme === "light");
    }
  });

  for (const [foreground, background, minimum] of readable) {
    test(`${foreground} on ${background} reaches ${minimum}:1 in every preset`, () => {
      const failures = THEME_PRESETS.map(
        (preset) => [preset.id, contrast(preset, foreground, background)] as const,
      )
        .filter(([, ratio]) => ratio < minimum)
        .map(([id, ratio]) => `${id} ${ratio.toFixed(2)}`);
      expect(failures).toEqual([]);
    });
  }
});
