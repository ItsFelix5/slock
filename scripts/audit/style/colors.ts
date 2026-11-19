import ts from "typescript";
import { isSource } from "../lib/files";
import { lineOf, parse, visit } from "../lib/parse";
import type { Rule, SourceFile, Violation } from "../lib/types";
import { parseCss } from "./css";
import { isThemeDefinition } from "./tokens";

const ids = ["color"];

const URL_CALL = /url\([^)]*\)/g;
const HEX = /(?<=^|[\s:,(])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COLOR_FUNCTION =
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!from\b|var\()[\d.+-][^)]*\)/g;
const NAMED = /\b(?:white|black)\b/g;
const COLOR_PROPERTY = /color|background|border|outline|fill|stroke|shadow|caret|accent/;

function rawColors(value: string, includeNamed: boolean): string[] {
  const bare = value.replace(URL_CALL, "");
  const found = [...bare.matchAll(HEX), ...bare.matchAll(COLOR_FUNCTION)].map((match) => match[0]);
  if (includeNamed) found.push(...[...bare.matchAll(NAMED)].map((match) => match[0]));
  return found;
}

function violation(file: SourceFile, line: number, color: string): Violation {
  return {
    rule: "color",
    path: file.path,
    line,
    message: `raw color ${color.trim()} (use a theme token)`,
  };
}

function checkCss(file: SourceFile): Violation[] {
  return parseCss(file.text).declarations.flatMap((declaration) =>
    rawColors(declaration.value, COLOR_PROPERTY.test(declaration.property)).map((color) =>
      violation(file, declaration.line, color),
    ),
  );
}

function checkSource(file: SourceFile): Violation[] {
  const tree = parse(file);
  const found: Violation[] = [];
  visit(tree, (node) => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node);
    if (!isText) return;
    for (const color of rawColors(node.text, false)) {
      found.push(violation(file, lineOf(tree, node), color));
    }
  });
  return found;
}

function check(files: SourceFile[]): Violation[] {
  return files.flatMap((file) => {
    if (isThemeDefinition(file.path) || file.isTest) return [];
    if (file.ext === ".css") return checkCss(file);
    return isSource(file) ? checkSource(file) : [];
  });
}

export const colorsRule: Rule = { group: "color", ids, check };
