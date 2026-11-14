import ts from "typescript";
import { isSource } from "./files";
import { type FunctionNode, functionName, isFunctionNode, lineSpan } from "./functions";
import { lineOf, parse, visit } from "./parse";
import type { Rule, SourceFile, Violation } from "./types";

const ids = ["long-function", "nesting"];

const MAX_LINES = 60;
const MAX_DEPTH = 7;

type Deepest = { depth: number; node: ts.Node };

function isJsx(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

function isCallback(node: ts.Node): boolean {
  if (!(ts.isArrowFunction(node) || ts.isFunctionExpression(node))) return false;
  return ts.isCallExpression(node.parent) || ts.isJsxExpression(node.parent);
}

function measure(node: ts.Node, depth: number, deepest: Deepest): void {
  const next = depth + (isJsx(node) || isCallback(node) ? 1 : 0);
  if (next > deepest.depth) {
    deepest.depth = next;
    deepest.node = node;
  }
  ts.forEachChild(node, (child) => measure(child, next, deepest));
}

function outermostFunctions(tree: ts.SourceFile): FunctionNode[] {
  const found: FunctionNode[] = [];
  const walk = (node: ts.Node) => {
    if (isFunctionNode(node)) found.push(node);
    else ts.forEachChild(node, walk);
  };
  walk(tree);
  return found;
}

function nestingViolations(file: SourceFile, tree: ts.SourceFile): Violation[] {
  return outermostFunctions(tree).flatMap((fn) => {
    if (!fn.body) return [];
    const deepest: Deepest = { depth: 0, node: fn };
    measure(fn.body, 0, deepest);
    if (deepest.depth <= MAX_DEPTH) return [];
    return [
      {
        rule: "nesting",
        path: file.path,
        line: lineOf(tree, deepest.node),
        message: `${functionName(fn)} nests ${deepest.depth} deep (JSX and callbacks), over ${MAX_DEPTH}`,
      },
    ];
  });
}

function lengthViolations(file: SourceFile, tree: ts.SourceFile): Violation[] {
  const found: Violation[] = [];
  visit(tree, (node) => {
    if (!isFunctionNode(node)) return;
    const lines = lineSpan(tree, node);
    if (lines <= MAX_LINES) return;
    found.push({
      rule: "long-function",
      path: file.path,
      line: lineOf(tree, node),
      message: `${functionName(node)} is ${lines} lines, over ${MAX_LINES}`,
    });
  });
  return found;
}

function check(files: SourceFile[]): Violation[] {
  return files
    .filter((file) => isSource(file) && !file.isTest)
    .flatMap((file) => {
      const tree = parse(file);
      return [...lengthViolations(file, tree), ...nestingViolations(file, tree)];
    });
}

export const longFunctionsRule: Rule = { group: "long", ids, check };
