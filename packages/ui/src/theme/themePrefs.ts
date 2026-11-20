import {
  clamp,
  createPref,
  type Env,
  isRecord,
  parseRecordOf,
  parseString,
  textCodec,
} from "@slock/core";
import { DEFAULT_FONT } from "./font";
import type { ThemeColors } from "./themeColorRegistry";

export interface ThemeShape {
  density: number;
  roundness: number;
}

const clampAxis = (value: number): number => clamp(value, 0, 2);

export function clampShape(shape: ThemeShape): ThemeShape {
  return { density: clampAxis(shape.density), roundness: clampAxis(shape.roundness) };
}

function parseShape(value: unknown): ThemeShape | undefined {
  if (!isRecord(value)) return;
  const { density, roundness } = value;
  if (typeof density !== "number" || typeof roundness !== "number") return;
  return clampShape({ density, roundness });
}

export function createThemePrefs(storage: Env["storage"]) {
  return {
    colors: createPref<ThemeColors>(storage, {
      fallback: {},
      key: "slock-theme-colors",
      parse: parseRecordOf(parseString),
    }),
    css: createPref<string | null>(storage, {
      codec: textCodec,
      fallback: null,
      key: "slock-theme-css",
      parse: parseString,
    }),
    font: createPref<string>(storage, {
      codec: textCodec,
      fallback: DEFAULT_FONT,
      key: "slock-theme-font",
      parse: parseString,
    }),
    preset: createPref<string | null>(storage, {
      codec: textCodec,
      fallback: null,
      key: "slock-theme-preset",
      parse: parseString,
    }),
    shape: createPref<ThemeShape>(storage, {
      fallback: { density: 1, roundness: 1 },
      key: "slock-theme-shape",
      parse: parseShape,
    }),
  };
}

export type ThemePrefs = ReturnType<typeof createThemePrefs>;
