import ts from "typescript";
import { lineOf, parse, visit } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["context-menu", "dblclick", "clickable"];

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

const KEYBOARD_CONTEXT_MENU = /openContextMenuFromKeyboard|["']ContextMenu["']|["']F10["']/;
const NON_INTERACTIVE = new Set([
  "div",
  "span",
  "li",
  "p",
  "img",
  "svg",
  "section",
  "article",
  "header",
  "footer",
  "aside",
  "td",
  "tr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);
const KEY_HANDLERS = ["onKeyDown", "onKeyUp", "onKeyPress"];
const PRESENTATION_ROLES = new Set(["presentation", "none"]);
const STOP_ONLY = /\.(?:stopPropagation|preventDefault)\(\)/;

function attributesOf(element: Opening): Map<string, ts.JsxAttribute> {
  const named = new Map<string, ts.JsxAttribute>();
  for (const attribute of element.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) named.set(attribute.name.getText(), attribute);
  }
  return named;
}

function stringValue(attribute: ts.JsxAttribute | undefined): string | undefined {
  const initializer = attribute?.initializer;
  if (!initializer) return;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const { expression } = initializer;
    if (ts.isStringLiteralLike(expression)) return expression.text;
  }
}

function onlyStopsEvent(attribute: ts.JsxAttribute): boolean {
  const text = attribute.initializer?.getText() ?? "";
  return text.length < 70 && STOP_ONLY.test(text);
}

function inspect(file: SourceFile, tree: ts.SourceFile, element: Opening, found: Violation[]) {
  const tag = element.tagName.getText();
  const attributes = attributesOf(element);
  const hasKeyHandler = KEY_HANDLERS.some((name) => attributes.has(name));
  const report = (rule: string, message: string) =>
    found.push({ rule, path: file.path, line: lineOf(tree, element), message });
  const contextMenu = attributes.get("onContextMenu");
  if (contextMenu && !onlyStopsEvent(contextMenu) && !KEYBOARD_CONTEXT_MENU.test(file.text)) {
    report("context-menu", `<${tag}> onContextMenu has no keyboard path in this file`);
  }
  if (attributes.has("onDblClick") && !hasKeyHandler) {
    report("dblclick", `<${tag}> onDblClick has no keyboard alternative`);
  }
  const click = attributes.get("onClick");
  const hasSpread = element.attributes.properties.some(ts.isJsxSpreadAttribute);
  if (!(click && NON_INTERACTIVE.has(tag)) || hasSpread || onlyStopsEvent(click)) return;
  if (PRESENTATION_ROLES.has(stringValue(attributes.get("role")) ?? "")) return;
  if (attributes.has("aria-modal")) return;
  const missing = [
    attributes.has("role") ? "" : "role",
    attributes.has("tabIndex") ? "" : "tabIndex",
    hasKeyHandler ? "" : "key handler",
  ].filter(Boolean);
  if (missing.length > 0) report("clickable", `<${tag}> onClick without ${missing.join(", ")}`);
}

function check(files: SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (file.ext !== ".tsx" || file.isTest) continue;
    const tree = parse(file);
    visit(tree, (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        inspect(file, tree, node, found);
      }
    });
  }
  return found;
}

export const mouseJsxRule: Rule = { group: "mouse", ids, check };
