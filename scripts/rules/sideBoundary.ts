import { posix } from "node:path";
import ts from "typescript";

type Side = "client" | "server" | undefined;

const CLIENT_PACKAGES = new Set(["blockkit", "resource", "ui"]);
const SERVER_PACKAGES = new Set(["installer", "relay"]);
const CLIENT_MODULE =
  /^(@slock\/(core\/(boot|solid)|blockkit|resource|ui)|@solidjs\/web|solid-js|quill|quill-delta)(\/|$)/;
const SERVER_MODULE = /^((@slock\/(core\/(http|serve)|installer)|bun)(\/|$)|bun:|node:)/;

function namedSide(segments: string[]): Side {
  if (segments.includes("client")) return "client";
  return segments.includes("server") ? "server" : undefined;
}

function directorySide(directories: string[]): Side {
  const [, name = ""] = directories;
  if (CLIENT_PACKAGES.has(name)) return "client";
  if (SERVER_PACKAGES.has(name)) return "server";
  return namedSide(directories);
}

function moduleSide(specifier: string, file: string, isDirectory: (path: string) => boolean): Side {
  if (specifier.startsWith(".")) {
    const target = posix.join(posix.dirname(file), specifier);
    const segments = target.split("/");
    return directorySide(isDirectory(target) ? segments : segments.slice(0, -1));
  }
  if (CLIENT_MODULE.test(specifier)) return "client";
  if (SERVER_MODULE.test(specifier)) return "server";
  return specifier.startsWith("@slock/") ? namedSide(specifier.split("/")) : undefined;
}

function moduleSpecifier(node: ts.Node): ts.Expression | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
  const dynamic = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
  return dynamic ? node.arguments[0] : undefined;
}

export function crossSideImports(
  source: ts.SourceFile,
  file: string,
  isDirectory: (path: string) => boolean,
): ts.Node[] {
  const own = directorySide(file.split("/").slice(0, -1));
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    const specifier = moduleSpecifier(node);
    if (specifier && ts.isStringLiteral(specifier)) {
      const side = moduleSide(specifier.text, file, isDirectory);
      if (side && side !== own) found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
