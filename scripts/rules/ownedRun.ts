import ts from "typescript";

export function ownedRuns(source: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "runWithOwner" &&
      node.arguments[0]?.kind !== ts.SyntaxKind.NullKeyword
    )
      found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
