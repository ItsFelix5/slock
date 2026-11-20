import { afterEach, describe, expect, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import { createThemeColorRegistry, themeColorVar } from "../src/theme/themeColorRegistry";
import {
  type ColorRef,
  colorRefToCss,
  formatColorRef,
  isColorRef,
  parseColorRef,
  resolveThemeColorValue,
} from "../src/theme/themeDerivations";

const sources = ["accent", "textPrimary", "mainBg", "accentHover"];

function randomRef(random: () => number): ColorRef {
  const ref: ColorRef = { source: pick(random, sources) };
  if (random() < 0.6) ref.deltaL = int(random, -90, 90) / 2;
  if (random() < 0.6) ref.deltaC = int(random, -90, 90) / 2;
  if (random() < 0.6) ref.alpha = int(random, 0, 100);
  return ref;
}

describe("color refs", () => {
  test("format then parse returns the same ref", () => {
    forAll(randomRef, (ref) => {
      expect(parseColorRef(formatColorRef(ref))).toEqual(ref);
    });
  });

  test("parses each term kind", () => {
    expect(parseColorRef("@accent -7%L 2.5%C 40%")).toEqual({
      alpha: 40,
      deltaC: 2.5,
      deltaL: -7,
      source: "accent",
    });
    expect(parseColorRef("@accent")).toEqual({ source: "accent" });
  });

  test("rejects values that are not refs", () => {
    for (const value of [
      "accent",
      "#fff",
      "@",
      "@acc ent",
      "@accent 5",
      "@accent %L",
      "oklch(0.5 0.1 20)",
    ]) {
      expect(isColorRef(value)).toBe(false);
    }
  });

  test("tolerates surrounding whitespace", () => {
    expect(parseColorRef("  @accent 10%L  ")).toEqual({
      deltaL: 10,
      source: "accent",
    });
  });
});

describe("colorRefToCss", () => {
  const registry = createThemeColorRegistry();
  const isKnown = (key: string) => registry.themeColorDefinitions().some((def) => def.key === key);
  let remove = () => {};
  afterEach(() => remove());

  test("returns unknown sources untouched", () => {
    expect(colorRefToCss("@ghost 10%L", isKnown)).toBe("@ghost 10%L");
    expect(resolveThemeColorValue("#123456", isKnown)).toBe("#123456");
  });

  test("builds channel shifts and alpha from the css variable", () => {
    remove = registry.add([{ key: "accentHover", label: "Hover" }]);
    const variable = `var(${themeColorVar("accentHover")})`;
    expect(colorRefToCss("@accentHover", isKnown)).toBe(variable);
    expect(colorRefToCss("@accentHover -5%L", isKnown)).toBe(
      `oklch(from ${variable} calc(l + -0.05) c h)`,
    );
    expect(colorRefToCss("@accentHover 2%C", isKnown)).toBe(
      `oklch(from ${variable} l calc(c + 0.02) h)`,
    );
    expect(colorRefToCss("@accentHover 30%", isKnown)).toBe(`rgb(from ${variable} r g b / 30%)`);
  });

  test("stops resolving once the definition is removed", () => {
    registry.add([{ key: "removedColor", label: "Hover" }])();
    expect(colorRefToCss("@removedColor", isKnown)).toBe("@removedColor");
  });
});

describe("themeColorVar", () => {
  test("kebab-cases camel keys and splits digits", () => {
    expect(themeColorVar("accentHover")).toBe("--accent-hover");
    expect(themeColorVar("gray500")).toBe("--gray-500");
    expect(themeColorVar("mainBg")).toBe("--main-bg");
  });
});
