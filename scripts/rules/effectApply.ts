import ts from "typescript";

const EFFECTS = new Set(["createEffect", "createRenderEffect"]);

function returnsValue(apply: ts.ArrowFunction): boolean {
  const { body } = apply;
  return !(ts.isBlock(body) || ts.isVoidExpression(body) || ts.isArrowFunction(body));
}

export function effectAppliesThatReturn(source: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      EFFECTS.has(node.expression.text)
    ) {
      const [, apply] = node.arguments;
      if (apply && ts.isArrowFunction(apply) && returnsValue(apply)) found.push(apply);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
