import { join, relative } from "node:path";
import ts from "typescript";

const COMPUTE_FACTORIES = new Set(["createEffect", "createMemo", "createRenderEffect"]);
const SETTER_TYPES = new Set(["Setter", "StoreSetter"]);
const EVENT_OR_REF = /^(on[A-Z]|on:|ref$)/;

export type Finding = { file: string; line: number };

function isFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)
  );
}

function eachSyncCall(root: ts.Node, visit: (call: ts.CallExpression) => void): void {
  let resumed = false;
  const walk = (node: ts.Node): void => {
    if (resumed || isFunction(node) || ts.isMethodDeclaration(node)) return;
    if (ts.isCallExpression(node)) visit(node);
    ts.forEachChild(node, walk);
    if (ts.isAwaitExpression(node)) resumed = true;
  };
  if (ts.isCallExpression(root)) visit(root);
  ts.forEachChild(root, walk);
}

function createWriteDetector(checker: ts.TypeChecker) {
  const verdicts = new Map<ts.Node, boolean>();

  const resolve = (expression: ts.Expression): ts.Symbol | undefined => {
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(expression) ? expression.name : expression,
    );
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) return checker.getAliasedSymbol(symbol);
    return symbol;
  };

  const bodyOf = (declaration: ts.Declaration): ts.Node | undefined => {
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration))
      return declaration.body;
    if (
      (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) &&
      declaration.initializer &&
      isFunction(declaration.initializer)
    )
      return declaration.initializer.body;
    if (ts.isShorthandPropertyAssignment(declaration)) {
      const target = checker.getShorthandAssignmentValueSymbol(declaration);
      return target?.declarations?.map(bodyOf).find((body) => body !== undefined);
    }
  };

  const bodyWrites = (body: ts.Node): boolean => {
    const cached = verdicts.get(body);
    if (cached !== undefined) return cached;
    verdicts.set(body, false);
    let writes = false;
    eachSyncCall(body, (call) => {
      if (callWrites(call)) writes = true;
    });
    verdicts.set(body, writes);
    return writes;
  };

  function callWrites(call: ts.CallExpression): boolean {
    const alias = checker.getTypeAtLocation(call.expression).aliasSymbol?.name;
    if (alias && SETTER_TYPES.has(alias)) return true;
    const symbol = resolve(call.expression);
    return (
      symbol?.declarations?.some((declaration) => {
        const body = bodyOf(declaration);
        return body !== undefined && bodyWrites(body);
      }) ?? false
    );
  }

  return callWrites;
}

function computeRoots(source: ts.SourceFile): ts.Node[] {
  const roots: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      COMPUTE_FACTORIES.has(node.expression.text)
    ) {
      const [compute] = node.arguments;
      if (compute && isFunction(compute) && compute.body) roots.push(compute.body);
    }
    if (ts.isJsxExpression(node) && node.expression && !isFunction(node.expression)) {
      const attribute = ts.isJsxAttribute(node.parent) ? node.parent.name.getText() : "";
      if (!EVENT_OR_REF.test(attribute)) roots.push(node.expression);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return roots;
}

export function writesInCompute(files: string[], root: string): Finding[] {
  const config = ts.readConfigFile(join(root, "tsconfig.base.json"), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(files, { ...options, noEmit: true });
  const callWrites = createWriteDetector(program.getTypeChecker());
  const found: Finding[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    for (const compute of computeRoots(source)) {
      eachSyncCall(compute, (call) => {
        if (!callWrites(call)) return;
        const line = source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1;
        found.push({ file: relative(root, file), line });
      });
    }
  }
  return found;
}
