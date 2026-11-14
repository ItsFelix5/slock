import ts from "typescript";
import { lineOf, parse, visit } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["leak"];

const CLEANUP_ANYWHERE = ["onCleanup"];
const CALL_CLEANUPS: Record<string, string[]> = {
  addEventListener: ["removeEventListener"],
  setInterval: ["clearInterval"],
  setTimeout: ["clearTimeout"],
};
const CONSTRUCTOR_CLEANUPS: Record<string, string[]> = {
  IntersectionObserver: ["disconnect", "unobserve"],
  ResizeObserver: ["disconnect", "unobserve"],
  MutationObserver: ["disconnect"],
  WebSocket: ["close"],
  EventSource: ["close"],
  BroadcastChannel: ["close"],
};
const SLEEP_CALLBACKS = new Set(["resolve", "res", "r", "done", "ok"]);

function usedNames(tree: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  visit(tree, (node) => {
    if (ts.isIdentifier(node)) names.add(node.text);
  });
  return names;
}

function calleeName(call: ts.CallExpression): string | undefined {
  const { expression } = call;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
}

function isOneShotListener(call: ts.CallExpression): boolean {
  const [, , options] = call.arguments;
  if (!options) return false;
  if (ts.isObjectLiteralExpression(options)) {
    return options.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        (property.name.getText() === "signal" ||
          (property.name.getText() === "once" && property.initializer.getText() === "true")),
    );
  }
  return false;
}

function isDeferOrSleep(call: ts.CallExpression): boolean {
  const [callback, delay] = call.arguments;
  if (delay && ts.isNumericLiteral(delay) && Number(delay.text) === 0) return true;
  return Boolean(callback && ts.isIdentifier(callback) && SLEEP_CALLBACKS.has(callback.text));
}

function isCovered(names: Set<string>, cleanups: string[]): boolean {
  return [...cleanups, ...CLEANUP_ANYWHERE].some((name) => names.has(name));
}

function ownedNames(tree: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const isOwned = (value: ts.Expression | undefined) =>
    value !== undefined &&
    (ts.isNewExpression(value) || (ts.isIdentifier(value) && names.has(value.text)));
  visit(tree, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isOwned(node.initializer)) {
      names.add(node.name.text);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      isOwned(node.right)
    ) {
      names.add(node.left.text);
    }
  });
  return names;
}

function receiverRoot(call: ts.CallExpression): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return;
  let target = call.expression.expression;
  while (ts.isPropertyAccessExpression(target)) target = target.expression;
  return ts.isIdentifier(target) ? target.text : undefined;
}

function isGlobalTimer(call: ts.CallExpression, name: string): boolean {
  return name === "addEventListener" || ts.isIdentifier(call.expression);
}

function check(files: SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (file.ext !== ".ts" && file.ext !== ".tsx") continue;
    if (file.isTest) continue;
    const tree = parse(file);
    const names = usedNames(tree);
    const owned = ownedNames(tree);
    const report = (node: ts.Node, what: string, cleanups: string[]) =>
      found.push({
        rule: "leak",
        path: file.path,
        line: lineOf(tree, node),
        message: `${what} without ${cleanups.join("/")} or onCleanup in this file`,
      });
    visit(tree, (node) => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(node);
        const cleanups = name ? CALL_CLEANUPS[name] : undefined;
        if (!(name && cleanups && isGlobalTimer(node, name))) return;
        if (name === "addEventListener" && isOneShotListener(node)) return;
        if (name === "addEventListener" && owned.has(receiverRoot(node) ?? "")) return;
        if (name === "setTimeout" && isDeferOrSleep(node)) return;
        if (!isCovered(names, cleanups)) report(node, `${name}()`, cleanups);
      }
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        const cleanups = CONSTRUCTOR_CLEANUPS[node.expression.text];
        if (cleanups && !isCovered(names, cleanups)) {
          report(node, `new ${node.expression.text}()`, cleanups);
        }
      }
    });
  }
  return found;
}

export const leaksRule: Rule = { group: "leak", ids, check };
