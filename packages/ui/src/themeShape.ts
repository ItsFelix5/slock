import { createSignal } from "solid-js";
import { metricsAt } from "./keyframeMetrics";

export interface ThemeShape {
  density: number;
  roundness: number;
}

type DensityMetrics = Record<
  | "avatarFontSize"
  | "avatarMarginTop"
  | "avatarSize"
  | "composerFrameBlockEnd"
  | "composerFrameInline"
  | "metaGap"
  | "rowPaddingOffset"
  | "rowPaddingY"
  | "space2xl"
  | "space3xl"
  | "spaceLg"
  | "spaceMd"
  | "spaceSm"
  | "spaceXl"
  | "spaceXs",
  number
>;

type RoundnessMetrics = Record<
  "controlRadius" | "pillRadius" | "radiusLg" | "radiusMd" | "radiusSm",
  number
>;

const DENSITY_KEYFRAMES: [number, DensityMetrics][] = [
  [
    0,
    {
      avatarFontSize: 10,
      avatarMarginTop: 0,
      avatarSize: 18,
      composerFrameBlockEnd: 0,
      composerFrameInline: 0,
      metaGap: 3,
      rowPaddingOffset: -4,
      rowPaddingY: 0,
      space2xl: 14,
      space3xl: 18,
      spaceLg: 8,
      spaceMd: 6,
      spaceSm: 4,
      spaceXl: 10,
      spaceXs: 2,
    },
  ],
  [
    1,
    {
      avatarFontSize: 14,
      avatarMarginTop: 2,
      avatarSize: 36,
      composerFrameBlockEnd: 8,
      composerFrameInline: 12,
      metaGap: 6,
      rowPaddingOffset: 0,
      rowPaddingY: 2,
      space2xl: 24,
      space3xl: 32,
      spaceLg: 16,
      spaceMd: 12,
      spaceSm: 8,
      spaceXl: 20,
      spaceXs: 4,
    },
  ],
  [
    2,
    {
      avatarFontSize: 15,
      avatarMarginTop: 3,
      avatarSize: 42,
      composerFrameBlockEnd: 14,
      composerFrameInline: 20,
      metaGap: 7,
      rowPaddingOffset: 6,
      rowPaddingY: 10,
      space2xl: 32,
      space3xl: 44,
      spaceLg: 21,
      spaceMd: 17,
      spaceSm: 11,
      spaceXl: 27,
      spaceXs: 5,
    },
  ],
];

const ROUNDNESS_KEYFRAMES: [number, RoundnessMetrics][] = [
  [0, { controlRadius: 0, pillRadius: 0, radiusLg: 0, radiusMd: 0, radiusSm: 0 }],
  [1, { controlRadius: 6, pillRadius: 999, radiusLg: 12, radiusMd: 8, radiusSm: 4 }],
  [2, { controlRadius: 999, pillRadius: 999, radiusLg: 40, radiusMd: 26, radiusSm: 14 }],
];

const THEME_SHAPE_KEY = "slock-theme-shape";

function clampAxis(value: number): number {
  return Math.min(2, Math.max(0, value));
}

function loadThemeShape(): ThemeShape {
  try {
    const stored = localStorage.getItem(THEME_SHAPE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.density === "number" && typeof parsed.roundness === "number")
        return { density: clampAxis(parsed.density), roundness: clampAxis(parsed.roundness) };
    }
  } catch {
    localStorage.removeItem(THEME_SHAPE_KEY);
  }

  const shape = { density: 1, roundness: 1 };
  localStorage.setItem(THEME_SHAPE_KEY, JSON.stringify(shape));
  return shape;
}

function applyThemeShape(shape: ThemeShape) {
  const root = document.documentElement;
  const density = metricsAt(DENSITY_KEYFRAMES, shape.density);
  root.style.setProperty("--space-xs", `${density.spaceXs}px`);
  root.style.setProperty("--space-sm", `${density.spaceSm}px`);
  root.style.setProperty("--space-md", `${density.spaceMd}px`);
  root.style.setProperty("--space-lg", `${density.spaceLg}px`);
  root.style.setProperty("--space-xl", `${density.spaceXl}px`);
  root.style.setProperty("--space-2xl", `${density.space2xl}px`);
  root.style.setProperty("--space-3xl", `${density.space3xl}px`);
  root.style.setProperty("--message-row-padding-y", `${density.rowPaddingY}px`);
  root.style.setProperty("--row-padding-offset", `${density.rowPaddingOffset}px`);
  root.style.setProperty("--message-avatar-size", `${density.avatarSize}px`);
  root.style.setProperty("--message-avatar-margin-top", `${density.avatarMarginTop}px`);
  root.style.setProperty("--message-avatar-font-size", `${density.avatarFontSize}px`);
  root.style.setProperty("--message-meta-gap", `${density.metaGap}px`);
  root.style.setProperty("--composer-frame-inline", `${density.composerFrameInline}px`);
  root.style.setProperty("--composer-frame-block-end", `${density.composerFrameBlockEnd}px`);

  const roundness = metricsAt(ROUNDNESS_KEYFRAMES, shape.roundness);
  root.style.setProperty("--radius-sm", `${roundness.radiusSm}px`);
  root.style.setProperty("--radius-md", `${roundness.radiusMd}px`);
  root.style.setProperty("--radius-lg", `${roundness.radiusLg}px`);
  root.style.setProperty("--radius-control", `${roundness.controlRadius}px`);
  root.style.setProperty("--radius-pill", `${roundness.pillRadius}px`);
}

const [themeShape, setThemeShapeSignal] = createSignal(loadThemeShape());
applyThemeShape(themeShape());

export function setThemeShape(next: Partial<ThemeShape>): void {
  const merged = {
    density: clampAxis(next.density ?? themeShape().density),
    roundness: clampAxis(next.roundness ?? themeShape().roundness),
  };
  setThemeShapeSignal(merged);
  localStorage.setItem(THEME_SHAPE_KEY, JSON.stringify(merged));
  applyThemeShape(merged);
}

export { themeShape };
