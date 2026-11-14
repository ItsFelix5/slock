import ts from "typescript";
import { lineOf } from "./parse";

export type FunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

export function isFunctionNode(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

export function lineSpan(tree: ts.SourceFile, node: ts.Node): number {
  return lineOf(tree, node.getEnd()) - lineOf(tree, node) + 1;
}

export function functionName(node: FunctionNode): string {
  if (node.name) return node.name.getText();
  const { parent } = node;
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) {
    return parent.name.getText();
  }
  return "anonymous";
}
