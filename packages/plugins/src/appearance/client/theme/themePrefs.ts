import type { PrefCodec } from "@slock/core";
import { clamp, createPref, type Env, isRecord } from "@slock/core";
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

export const textCodec: PrefCodec<string> = {
  decode: (raw) => raw,
  encode: (value) => value,
};

export function parseString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseRecordOf<V>(
  parseValue: (value: unknown) => V | undefined,
): (value: unknown) => Record<string, V> | undefined {
  return (value) => {
    if (!isRecord(value)) return;
    const out: Record<string, V> = {};
    for (const [key, entry] of Object.entries(value)) {
      const parsed = parseValue(entry);
      if (parsed !== undefined) out[key] = parsed;
    }
    return out;
  };
}
