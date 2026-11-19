import { defined } from "@slock/core";
import { themeColorDefinitions, themeColorVar } from "./themeColorRegistry";

export function translucent(color: string, amount: number) {
  return `rgb(from ${color} r g b / ${amount}%)`;
}

export function channelShift(color: string, deltaL?: number, deltaC?: number) {
  const l = deltaL === undefined ? "l" : `calc(l + ${deltaL / 100})`;
  const c = deltaC === undefined ? "c" : `calc(c + ${deltaC / 100})`;
  return `oklch(from ${color} ${l} ${c} h)`;
}

const REF_PATTERN = /^@([a-zA-Z]+)((?:\s+[+-]?\d+(?:\.\d+)?%[LC]?)*)$/;
const TERM_PATTERN = /([+-]?\d+(?:\.\d+)?)%([LC]?)/g;

export function isColorRef(value: string): boolean {
  return REF_PATTERN.test(value.trim());
}

export interface ColorRef {
  alpha?: number;
  deltaC?: number;
  deltaL?: number;
  source: string;
}

export function parseColorRef(ref: string): ColorRef | undefined {
  const match = REF_PATTERN.exec(ref.trim());
  if (!match) return;
  const parsed: ColorRef = { source: defined(match[1]) };
  for (const [, amount, unit] of defined(match[2]).matchAll(TERM_PATTERN)) {
    if (unit === "L") parsed.deltaL = Number(amount);
    else if (unit === "C") parsed.deltaC = Number(amount);
    else parsed.alpha = Number(amount);
  }
  return parsed;
}

export function formatColorRef({ source, deltaL, deltaC, alpha }: ColorRef): string {
  const terms = [
    deltaL === undefined ? "" : ` ${deltaL}%L`,
    deltaC === undefined ? "" : ` ${deltaC}%C`,
    alpha === undefined ? "" : ` ${alpha}%`,
  ];
  return `@${source}${terms.join("")}`;
}

export function colorRefToCss(ref: string): string {
  const parsed = parseColorRef(ref);
  if (!(parsed && themeColorDefinitions().some((def) => def.key === parsed.source))) return ref;
  let expr = `var(${themeColorVar(parsed.source)})`;
  if (parsed.deltaL !== undefined || parsed.deltaC !== undefined)
    expr = channelShift(expr, parsed.deltaL, parsed.deltaC);
  return parsed.alpha === undefined ? expr : translucent(expr, parsed.alpha);
}

export function resolveThemeColorValue(value: string): string {
  return isColorRef(value) ? colorRefToCss(value) : value;
}
