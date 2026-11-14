import { parseCss, splitSelectorList } from "./css";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["hover-only"];

const LEADING_PSEUDOS = /^(?::{1,2}[\w-]+(?:\([^)]*\))?)+/;
const FOCUS_PSEUDO = /:focus-within|:focus-visible|:has\([^)]*:focus/;
const REVEAL = /^(?:\s+|\s*[>+~])\S/;
const WHITESPACE = /\s+/g;
const COMBINATOR = /\s*([>+~])\s*/g;
const COMBINATORS = new Set([">", "+", "~"]);
const REVEAL_PROPERTIES = new Set([
  "opacity",
  "visibility",
  "display",
  "pointer-events",
  "clip-path",
  "max-height",
]);

type Part = { text: string; line: number; revealing: boolean };

function normalize(tail: string): string {
  return tail.replace(WHITESPACE, " ").replace(COMBINATOR, " $1 ").trim();
}

function lastCompound(selector: string): string {
  const compounds = normalize(selector)
    .split(" ")
    .filter((token) => !COMBINATORS.has(token));
  return compounds.at(-1) ?? "";
}

function afterGroup(text: string, open: number): string {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "(") depth++;
    if (text[index] === ")" && --depth === 0) return text.slice(index + 1);
  }
  return "";
}

function hoverTail(part: string): string | undefined {
  const index = part.indexOf(":hover");
  if (index === -1) return;
  const tail = part.slice(index + ":hover".length).replace(LEADING_PSEUDOS, "");
  return REVEAL.test(tail) ? tail : undefined;
}

function focusTargets(parts: Part[]): Set<string> {
  const targets = new Set<string>();
  for (const { text } of parts) {
    const match = FOCUS_PSEUDO.exec(text);
    if (!match) continue;
    const isHas = match[0].startsWith(":has");
    const after = isHas
      ? afterGroup(text, match.index + ":has".length)
      : text.slice(match.index + match[0].length);
    targets.add(normalize(after.replace(LEADING_PSEUDOS, "")));
    targets.add(lastCompound(text.slice(0, match.index)));
  }
  return targets;
}

function partsOf(file: SourceFile): Part[] {
  const { selectors, declarations } = parseCss(file.text);
  const revealing = new Set(
    declarations
      .filter((declaration) => REVEAL_PROPERTIES.has(declaration.property))
      .map((declaration) => declaration.selector),
  );
  return selectors
    .filter((selector) => !selector.text.startsWith("@"))
    .flatMap((selector) =>
      splitSelectorList(selector.text).map((text) => ({
        text,
        line: selector.line,
        revealing: revealing.has(selector.text),
      })),
    );
}

function check(files: SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (file.ext !== ".css") continue;
    const parts = partsOf(file);
    const targets = focusTargets(parts);
    for (const part of parts) {
      const tail = hoverTail(part.text);
      if (tail === undefined || !part.revealing || FOCUS_PSEUDO.test(part.text)) continue;
      if (targets.has(normalize(tail)) || targets.has(lastCompound(tail))) continue;
      found.push({
        rule: "hover-only",
        path: file.path,
        line: part.line,
        message: `:hover reveals "${normalize(tail)}" with no :focus-within or :focus-visible twin`,
      });
    }
  }
  return found;
}

export const hoverCssRule: Rule = { group: "mouse", ids, check };
