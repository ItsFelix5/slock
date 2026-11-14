import ts from "typescript";
import { isSource } from "./files";
import { lineOf, parse, preview, visit } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["copy-length", "copy-tone"];

const LONG_ATTRIBUTES = new Set(["title", "aria-label", "placeholder"]);
const MAX_LENGTH = 40;
const EXCLAMATION = /[A-Za-z]{2,}!(?:\s|$)/;
const PLEASE = /\bplease\b/i;

function textOf(node: ts.Node): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    return node.text;
  }
  if (ts.isJsxText(node)) return node.text;
}

function attributeText(attribute: ts.JsxAttribute): string | undefined {
  const { initializer } = attribute;
  if (!initializer) return;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    return ts.isStringLiteralLike(initializer.expression) ? initializer.expression.text : undefined;
  }
}

function check(files: SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (!isSource(file) || file.isTest || file.area === "scripts") continue;
    const tree = parse(file);
    visit(tree, (node) => {
      const at = (rule: string, message: string) =>
        found.push({ rule, path: file.path, line: lineOf(tree, node), message });
      if (ts.isJsxAttribute(node) && LONG_ATTRIBUTES.has(node.name.getText())) {
        const value = attributeText(node);
        if (value && value.length > MAX_LENGTH) {
          at("copy-length", `${node.name.getText()} is ${value.length} chars: "${preview(value)}"`);
        }
      }
      const text = textOf(node);
      if (text && (EXCLAMATION.test(text) || PLEASE.test(text))) {
        at("copy-tone", `exclamation or please: "${preview(text)}"`);
      }
    });
  }
  return found;
}

export const copyRule: Rule = { group: "copy", ids, check };
