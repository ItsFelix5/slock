import { parseCss } from "./css";
import type { SourceFile } from "./types";

export type Tokens = {
  spacing: Map<string, string>;
  radius: Map<string, string>;
  fontSize: Map<string, string>;
  utilities: Map<string, string>;
};

const THEME_PATH = "packages/ui/src/theme.css";
const UTILITIES_PATH = "packages/ui/src/utilities.css";
const LITERAL_LENGTH = /^-?\d+(?:\.\d+)?(?:px|%)$/;
const SIMPLE_CLASS = /^\.[\w-]+$/;

export function isThemeDefinition(path: string): boolean {
  const directory = THEME_PATH.slice(0, THEME_PATH.lastIndexOf("/") + 1);
  return path.startsWith(directory) && path.slice(directory.length).startsWith("theme");
}

function indexByValue(prefix: string, custom: Map<string, string>): Map<string, string> {
  const result = new Map<string, string>();
  for (const [name, value] of custom) {
    if (name.startsWith(prefix) && LITERAL_LENGTH.test(value) && !result.has(value)) {
      result.set(value, name);
    }
  }
  return result;
}

function singleDeclarationUtilities(utilities: SourceFile | undefined): Map<string, string> {
  const bySelector = new Map<string, { property: string; value: string }[]>();
  for (const { selector, property, value } of parseCss(utilities?.text ?? "").declarations) {
    bySelector.set(selector, [...(bySelector.get(selector) ?? []), { property, value }]);
  }
  const result = new Map<string, string>();
  for (const [selector, own] of bySelector) {
    const [only] = own;
    if (own.length === 1 && only && SIMPLE_CLASS.test(selector)) {
      result.set(`${only.property}:${only.value}`, selector);
    }
  }
  return result;
}

export function readTokens(files: SourceFile[]): Tokens {
  const theme = files.find((file) => file.path === THEME_PATH);
  const custom = new Map<string, string>();
  for (const declaration of parseCss(theme?.text ?? "").declarations) {
    if (declaration.property.startsWith("--")) custom.set(declaration.property, declaration.value);
  }
  return {
    spacing: indexByValue("--space-", custom),
    radius: indexByValue("--radius-", custom),
    fontSize: indexByValue("--font-size-", custom),
    utilities: singleDeclarationUtilities(files.find((file) => file.path === UTILITIES_PATH)),
  };
}
