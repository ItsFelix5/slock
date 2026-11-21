import ts from "typescript";

const STATE_FACTORIES = new Set([
  "createOptimistic",
  "createOptimisticStore",
  "createSignal",
  "createStore",
]);
const SCOPE = /^packages\/plugins\/src\/[^/]+\/client\/(?!(?:.*\/)?views\/)(?:.*\.ts$|index\.tsx$)/;

function setterName(node: ts.Node): string | undefined {
  if (
    !(
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      STATE_FACTORIES.has(node.initializer.expression.text)
    )
  )
    return;
  const [, element] = node.name.elements;
  return element && ts.isBindingElement(element) && ts.isIdentifier(element.name)
    ? element.name.text
    : undefined;
}

export function exportedSetters(source: ts.SourceFile, rel: string): ts.Node[] {
  if (!SCOPE.test(rel)) return [];
  const setters = new Set<string>();
  const found: ts.Node[] = [];
  const collect = (node: ts.Node): void => {
    const name = setterName(node);
    if (name) setters.add(name);
    ts.forEachChild(node, collect);
  };
  const flag = (node: ts.Node): void => {
    if (ts.isShorthandPropertyAssignment(node) && setters.has(node.name.text)) found.push(node);
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.initializer) &&
      setters.has(node.initializer.text)
    )
      found.push(node);
    ts.forEachChild(node, flag);
  };
  collect(source);
  flag(source);
  return found;
}
