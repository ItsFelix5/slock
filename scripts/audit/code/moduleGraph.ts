import { dirname, join, normalize } from "node:path";
import ts from "typescript";
import { isSource } from "../lib/files";
import { lineOf, parse } from "../lib/parse";
import type { SourceFile } from "../lib/types";

type Declared = { name: string; line: number; from?: { path: string; name: string } };
type ModuleInfo = {
  file: SourceFile;
  declared: Declared[];
  stars: string[];
  uses: { path: string; name: string }[];
  wholeModules: string[];
};

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const PACKAGE_JSON = /(^|\/)package\.json$/;

type PackageEntry = { dir: string; exports: Record<string, string> };

function packageEntries(files: SourceFile[]): Map<string, PackageEntry> {
  const entries = new Map<string, PackageEntry>();
  for (const file of files) {
    if (!PACKAGE_JSON.test(file.path) || file.path.split("/").length > 3) continue;
    const manifest: { name?: string; exports?: Record<string, string> } = JSON.parse(file.text);
    if (manifest.name) {
      entries.set(manifest.name, { dir: dirname(file.path), exports: manifest.exports ?? {} });
    }
  }
  return entries;
}

function createResolver(files: SourceFile[]) {
  const known = new Set(files.map((file) => file.path));
  const packages = packageEntries(files);
  const withExtension = (base: string) =>
    EXTENSIONS.map((extension) => normalize(base + extension)).find((path) => known.has(path));
  const fromPackage = (specifier: string): string | undefined => {
    const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier;
    const entry = packages.get(name);
    if (!entry) return;
    const subpath = `.${specifier.slice(name.length)}`;
    for (const [key, target] of Object.entries(entry.exports)) {
      const star = key.indexOf("*");
      if (star === -1 ? key === subpath : subpath.startsWith(key.slice(0, star))) {
        const wildcard = star === -1 ? "" : subpath.slice(star);
        return withExtension(join(entry.dir, target.replace("*", wildcard)));
      }
    }
  };
  return (from: string, specifier: string): string | undefined =>
    specifier.startsWith(".")
      ? withExtension(join(dirname(from), specifier))
      : fromPackage(specifier);
}

function declarationName(statement: ts.Statement): string[] {
  const isNamed =
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement);
  return isNamed && statement.name ? [statement.name.text] : [];
}

function exportedNames(statement: ts.Statement): string[] {
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
  const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  if (!isExported) return [];
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return ["default"];
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name)
        ? [declaration.name.text]
        : declaration.name.elements.flatMap((element) =>
            ts.isBindingElement(element) && ts.isIdentifier(element.name)
              ? [element.name.text]
              : [],
          ),
    );
  }
  return declarationName(statement);
}

function readModule(
  file: SourceFile,
  resolve: (from: string, specifier: string) => string | undefined,
): ModuleInfo {
  const tree = parse(file);
  const info: ModuleInfo = { file, declared: [], stars: [], uses: [], wholeModules: [] };
  const target = (node: ts.Expression | undefined) =>
    node && ts.isStringLiteral(node) ? resolve(file.path, node.text) : undefined;
  for (const statement of tree.statements) {
    const line = lineOf(tree, statement);
    for (const name of exportedNames(statement)) info.declared.push({ name, line });
    if (ts.isExportAssignment(statement)) info.declared.push({ name: "default", line });
    if (ts.isImportDeclaration(statement)) {
      const path = target(statement.moduleSpecifier);
      const bindings = statement.importClause?.namedBindings;
      if (!path) continue;
      if (statement.importClause?.name) info.uses.push({ path, name: "default" });
      if (bindings && ts.isNamespaceImport(bindings)) info.wholeModules.push(path);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          info.uses.push({ path, name: (element.propertyName ?? element.name).text });
        }
      }
    }
    if (ts.isExportDeclaration(statement)) {
      const path = target(statement.moduleSpecifier);
      const clause = statement.exportClause;
      if (!clause) {
        if (path) info.stars.push(path);
      } else if (ts.isNamespaceExport(clause)) {
        info.declared.push({ name: clause.name.text, line });
        if (path) info.wholeModules.push(path);
      } else {
        for (const element of clause.elements) {
          const source = (element.propertyName ?? element.name).text;
          info.declared.push({
            name: element.name.text,
            line,
            from: path ? { path, name: source } : undefined,
          });
        }
      }
    }
  }
  collectDynamic(tree, file, resolve, info);
  return info;
}

function collectDynamic(
  tree: ts.SourceFile,
  file: SourceFile,
  resolve: (from: string, specifier: string) => string | undefined,
  info: ModuleInfo,
): void {
  const scan = (node: ts.Node) => {
    const literal = dynamicImportTarget(node);
    const path = literal ? resolve(file.path, literal) : undefined;
    if (path) info.wholeModules.push(path);
    ts.forEachChild(node, scan);
  };
  scan(tree);
}

function dynamicImportTarget(node: ts.Node): string | undefined {
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments[0] &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return ts.isStringLiteral(node.argument.literal) ? node.argument.literal.text : undefined;
  }
}

export function readModules(files: SourceFile[]): ModuleInfo[] {
  const resolve = createResolver(files);
  return files
    .filter((file) => isSource(file) && !file.path.endsWith(".d.ts"))
    .map((file) => readModule(file, resolve));
}
