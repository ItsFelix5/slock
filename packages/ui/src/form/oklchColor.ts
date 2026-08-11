export interface OklchColor {
  alpha: number;
  chroma: number;
  hue: number;
  lightness: number;
}

const FALLBACK_COLOR: OklchColor = {
  alpha: 1,
  chroma: 0.145,
  hue: 250,
  lightness: 0.66,
};
const HEX_RE = /^#([\da-f]{6})([\da-f]{2})?$/i;
const OKLCH_RE = /oklch\(\s*([^\s/]+)\s+([^\s/]+)\s+([^\s/)]+)(?:\s*\/\s*([^\s)]+))?\s*\)/i;
const RGB_CHANNEL_RE = /[\s,]+/;
const RGB_RE = /rgba?\((.+)\)/i;
const SRGB_RE = /color\(srgb\s+([^\s/]+)\s+([^\s/]+)\s+([^\s/)]+)(?:\s*\/\s*([^\s)]+))?\)/i;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value: string, percentScale = 1): number {
  const parsed = Number.parseFloat(value);
  return value.endsWith("%") ? (parsed / 100) * percentScale : parsed;
}

function parseAlpha(value?: string): number {
  return value && value !== "none" ? clamp(parseNumber(value)) : 1;
}

function srgbChannelToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToOklch(red: number, green: number, blue: number, alpha = 1): OklchColor {
  const r = srgbChannelToLinear(clamp(red));
  const g = srgbChannelToLinear(clamp(green));
  const b = srgbChannelToLinear(clamp(blue));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a * a + labB * labB);
  const hue = chroma < 0.0001 ? FALLBACK_COLOR.hue : (Math.atan2(labB, a) * 180) / Math.PI;
  return {
    alpha: clamp(alpha),
    chroma,
    hue: hue < 0 ? hue + 360 : hue,
    lightness: clamp(lightness),
  };
}

function parseOklch(value: string): OklchColor | undefined {
  const match = value.match(OKLCH_RE);
  if (!match) return;
  const lightness = parseNumber(match[1]);
  const chroma = parseNumber(match[2], 0.4);
  const hue = match[3] === "none" ? FALLBACK_COLOR.hue : Number.parseFloat(match[3]);
  if (![lightness, chroma, hue].every(Number.isFinite)) return;
  return {
    alpha: parseAlpha(match[4]),
    chroma: clamp(chroma, 0, 0.4),
    hue: ((hue % 360) + 360) % 360,
    lightness: clamp(lightness),
  };
}

function parseRgb(value: string): OklchColor | undefined {
  const match = value.match(RGB_RE);
  if (!match) return;
  const [channels, alpha] = match[1].split("/").map((part) => part.trim());
  const parts = channels.split(RGB_CHANNEL_RE).filter(Boolean);
  if (parts.length < 3) return;
  const rgb = parts.slice(0, 3).map((part) => parseNumber(part, 255) / 255);
  if (!rgb.every(Number.isFinite)) return;
  const [red, green, blue] = rgb;
  const [, , , legacyAlpha] = parts;
  return rgbToOklch(red, green, blue, parseAlpha(alpha ?? legacyAlpha));
}

function parseSrgb(value: string): OklchColor | undefined {
  const match = value.match(SRGB_RE);
  if (!match) return;
  const rgb = match.slice(1, 4).map(Number);
  if (!rgb.every(Number.isFinite)) return;
  return rgbToOklch(rgb[0], rgb[1], rgb[2], parseAlpha(match[4]));
}

function parseHex(value: string): OklchColor | undefined {
  const match = value.match(HEX_RE);
  if (!match) return;
  const color = Number.parseInt(match[1], 16);
  const alpha = match[2] ? Number.parseInt(match[2], 16) / 255 : 1;
  return rgbToOklch(
    ((color >> 16) & 255) / 255,
    ((color >> 8) & 255) / 255,
    (color & 255) / 255,
    alpha,
  );
}

function resolvedCssColor(value: string): string {
  if (typeof document === "undefined") return value;
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  document.documentElement.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

export function cssColorToOklch(value: string): OklchColor {
  const direct = parseOklch(value) ?? parseHex(value) ?? parseRgb(value) ?? parseSrgb(value);
  if (direct) return direct;
  const resolved = resolvedCssColor(value);
  return parseOklch(resolved) ?? parseRgb(resolved) ?? parseSrgb(resolved) ?? FALLBACK_COLOR;
}

export function formatOklch(color: OklchColor): string {
  const lightness = clamp(color.lightness).toFixed(3);
  const chroma = clamp(color.chroma, 0, 0.4).toFixed(3);
  const hue = (((color.hue % 360) + 360) % 360).toFixed(1);
  const alpha = clamp(color.alpha);
  return alpha < 0.999
    ? `oklch(${lightness} ${chroma} ${hue} / ${alpha.toFixed(2)})`
    : `oklch(${lightness} ${chroma} ${hue})`;
}
