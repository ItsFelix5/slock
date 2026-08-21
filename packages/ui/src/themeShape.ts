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

type RoundnessMetrics = Record<"controlRadius" | "radiusLg" | "radiusMd" | "radiusSm", number>;

const DENSITY_KEYFRAMES: [number, DensityMetrics][] = [
  [
    0,
    {
      avatarFontSize: 11,
      avatarMarginTop: 1,
      avatarSize: 22,
      composerFrameBlockEnd: 0,
      composerFrameInline: 0,
      metaGap: 4,
      rowPaddingY: 0,
      space2xl: 18,
      space3xl: 24,
      spaceLg: 12,
      spaceMd: 9,
      spaceSm: 6,
      spaceXl: 14,
      spaceXs: 3,
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
      avatarFontSize: 14,
      avatarMarginTop: 2,
      avatarSize: 40,
      composerFrameBlockEnd: 14,
      composerFrameInline: 20,
      metaGap: 6,
      rowPaddingY: 10,
      space2xl: 32,
      space3xl: 42,
      spaceLg: 20,
      spaceMd: 16,
      spaceSm: 10,
      spaceXl: 26,
      spaceXs: 5,
    },
  ],
];

const ROUNDNESS_KEYFRAMES: [number, RoundnessMetrics][] = [
  [0, { controlRadius: 0, radiusLg: 0, radiusMd: 0, radiusSm: 0 }],
  [1, { controlRadius: 6, radiusLg: 12, radiusMd: 8, radiusSm: 4 }],
  [2, { controlRadius: 12, radiusLg: 24, radiusMd: 16, radiusSm: 8 }],
];

const THEME_SHAPE_KEY = "slock-theme-shape";

function clampAxis(value: number): number {
  return Math.min(2, Math.max(0, value));
}

function loadThemeShape(): ThemeShape {
  try {
    const stored = localStorage.getItem(THEME_SHAPE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ThemeShape>;
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
