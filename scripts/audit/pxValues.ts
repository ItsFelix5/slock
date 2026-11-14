import { parseCss } from "./css";
import { isThemeDefinition, readTokens, type Tokens } from "./tokens";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["px"];

const SPACING_PROPERTY =
  /^(?:(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)$/;
const RADIUS_PROPERTY = /^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/;
const LENGTH = /(?<![\w.-])-?\d+(?:\.\d+)?(?:px|%)/g;
const URL_CALL = /url\([^)]*\)/g;

function tokenMapFor(property: string, tokens: Tokens): Map<string, string> | undefined {
  if (SPACING_PROPERTY.test(property)) return tokens.spacing;
  if (RADIUS_PROPERTY.test(property)) return tokens.radius;
  if (property === "font-size") return tokens.fontSize;
}

function suggestion(property: string, name: string, wholeValue: boolean, tokens: Tokens): string {
  const utility = wholeValue ? tokens.utilities.get(`${property}:var(${name})`) : undefined;
  return utility ? `${utility} or var(${name})` : `var(${name})`;
}

function check(files: SourceFile[]): Violation[] {
  const tokens = readTokens(files);
  const found: Violation[] = [];
  for (const file of files) {
    if (file.ext !== ".css" || isThemeDefinition(file.path)) continue;
    for (const declaration of parseCss(file.text).declarations) {
      const map = tokenMapFor(declaration.property, tokens);
      if (!map) continue;
      const bare = declaration.value.replace(URL_CALL, "");
      for (const [literal] of bare.matchAll(LENGTH)) {
        const name = map.get(literal);
        if (!name) continue;
        const use = suggestion(declaration.property, name, bare.trim() === literal, tokens);
        found.push({
          rule: "px",
          path: file.path,
          line: declaration.line,
          message: `${declaration.property} ${literal}: use ${use}`,
        });
      }
    }
  }
  return found;
}

export const pxValuesRule: Rule = { group: "px", ids, check };
