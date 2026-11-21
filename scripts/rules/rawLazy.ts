import ts from "typescript";

const SOLID_MODULES = new Set(["solid-js", "@solidjs/web"]);

export function rawLazyImports(source: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!SOLID_MODULES.has(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!(bindings && ts.isNamedImports(bindings))) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === "lazy") found.push(element);
    }
  }
  return found;
}
