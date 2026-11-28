import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { effectAppliesThatReturn } from "./rules/effectApply.ts";
import { exportedSetters } from "./rules/exportedSetter.ts";
import { ownedRuns } from "./rules/ownedRun.ts";
import { rawLazyImports } from "./rules/rawLazy.ts";
import { crossSideImports } from "./rules/sideBoundary.ts";
import { writesInCompute } from "./rules/writeInCompute.ts";

const ROOT = join(import.meta.dir, "..");
const MAX_LINES = 300;
const SOLID_MODULES = new Set(["solid-js", "solid-js/store", "solid-js/web", "@solidjs/web"]);
const REMOVED_SOLID_API = new Set([
  "batch",
  "createResource",
  "Dynamic",
  "ErrorBoundary",
  "Index",
  "mergeProps",
  "on",
  "produce",
  "splitProps",
  "Suspense",
  "unwrap",
]);
const RAW_ENV_CALLS = new Set([
  "clearInterval",
  "clearTimeout",
  "fetch",
  "setInterval",
  "setTimeout",
]);
const STORAGE_GLOBALS = new Set(["localStorage", "sessionStorage"]);
const STATE_FACTORIES = new Set(["createRoot", "createSignal", "createStore"]);
const SUPPRESSION = /biome-ignore|@ts-ignore|@ts-expect-error|@ts-nocheck/;
const TEST_SUPPORT_IMPORT = /^(\.\.\/)+test\//;
const TEST_PATH =
  /(^|\/)(tests?|__tests__|__mocks__|mocks?|fakes?|testing)(\/|\.tsx?$)|(^|\/)(fake|mock)[A-Z.-][^/]*$|Testing\.tsx?$|\.(test|spec)\.tsx?$/;
const TEST_MODULE = /(from|import)\s*\(?\s*["'](bun:test|happy-dom)["']/;
const OUTSIDE_TEST = ["examplePlugin", "packages", "scripts"];
const LAZY_OWNER = "packages/core/src/client/solid.tsx";
const ENV_EXEMPT = [
  "packages/core/src/env.ts",
  "packages/core/src/client/browserEnv.ts",
  "packages/relay/",
  "packages/installer/",
];
const MODULE_STATE_EXEMPT = [
  "packages/core/src/services.ts",
  "packages/slack/src/client/account.ts",
];
const OWNED_RUN_EXEMPT = ["packages/plugins/src/shell/client/store/viewState.ts"];
const SCRIPT_KINDS = new Set(["ts", "tsx"]);

type Violation = { file: string; line: number; rule: string };

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    const extension = entry.name.split(".").pop() ?? "";
    return SCRIPT_KINDS.has(extension) && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

function packageSources(): string[] {
  return readdirSync(join(ROOT, "packages")).flatMap((name) => {
    const src = join(ROOT, "packages", name, "src");
    return existsSync(src) ? sourceFiles(src) : [];
  });
}

function isDirectory(path: string): boolean {
  return statSync(join(ROOT, path), { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function importedSpecifier(node: ts.Node): string | undefined {
  if (!(ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))) return;
  return node.moduleSpecifier.text;
}

function topLevelState(node: ts.Statement): boolean {
  if (!ts.isVariableStatement(node)) return false;
  const { flags } = node.declarationList;
  return (
    (flags & ts.NodeFlags.Let) !== 0 ||
    node.declarationList.declarations.some((declaration) => {
      const init = declaration.initializer;
      return (
        init !== undefined &&
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        STATE_FACTORIES.has(init.expression.text)
      );
    })
  );
}

function check(file: string): Violation[] {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: Violation[] = [];
  const add = (node: ts.Node, rule: string) =>
    found.push({
      file: rel,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      rule,
    });
  const envExempt = ENV_EXEMPT.some((prefix) => rel.startsWith(prefix));

  if (text.split("\n").length - 1 > MAX_LINES)
    found.push({ file: rel, line: 1, rule: "file-size" });
  if (SUPPRESSION.test(text)) found.push({ file: rel, line: 1, rule: "suppression" });
  if (!MODULE_STATE_EXEMPT.includes(rel)) {
    for (const statement of source.statements) {
      if (topLevelState(statement)) add(statement, "module-state");
    }
  }

  for (const node of crossSideImports(source, rel, isDirectory)) add(node, "cross-side-import");
  for (const node of exportedSetters(source, rel)) add(node, "exported-setter");
  if (rel !== LAZY_OWNER) for (const node of rawLazyImports(source)) add(node, "raw-lazy");
  for (const node of effectAppliesThatReturn(source)) add(node, "effect-apply-returns");
  if (!OWNED_RUN_EXEMPT.includes(rel)) for (const node of ownedRuns(source)) add(node, "owned-run");

  const visit = (node: ts.Node): void => {
    const specifier = importedSpecifier(node);
    if (specifier && TEST_SUPPORT_IMPORT.test(specifier)) {
      add(node, "test-support-in-src");
    }
    if (specifier && SOLID_MODULES.has(specifier) && ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (REMOVED_SOLID_API.has((element.propertyName ?? element.name).text)) {
            add(element, "removed-solid-api");
          }
        }
      }
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const isConst = ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === "const";
      if (!isConst) add(node, "no-cast");
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) add(node, "no-any");
    if (ts.isCatchClause(node) && node.block.statements.length === 0) add(node, "empty-catch");
    if (ts.isSwitchStatement(node) && !node.caseBlock.clauses.some(ts.isDefaultClause))
      add(node, "switch-without-default");
    if (ts.isJsxAttribute(node) && node.name.getText() === "classList")
      add(node, "removed-solid-api");
    if (!envExempt) {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee) && RAW_ENV_CALLS.has(callee.text)) add(node, "raw-env");
        if (ts.isPropertyAccessExpression(callee)) {
          const name = callee.getText();
          if (name === "Date.now" || name === "Math.random") add(node, "raw-env");
        }
      }
      if (
        ts.isNewExpression(node) &&
        node.expression.getText() === "Date" &&
        !node.arguments?.length
      ) {
        add(node, "raw-env");
      }
      if (ts.isIdentifier(node) && STORAGE_GLOBALS.has(node.text)) add(node, "raw-env");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function checkTestSize(file: string): Violation[] {
  const lines = readFileSync(file, "utf8").split("\n").length - 1;
  return lines > MAX_LINES ? [{ file: relative(ROOT, file), line: 1, rule: "file-size" }] : [];
}

function checkPlacement(file: string): Violation[] {
  const rel = relative(ROOT, file);
  const misplaced = TEST_PATH.test(rel) || TEST_MODULE.test(readFileSync(file, "utf8"));
  return misplaced ? [{ file: rel, line: 1, rule: "test-outside-test" }] : [];
}

const sources = packageSources();
const violations = [
  ...sources.flatMap(check),
  ...writesInCompute(sources, ROOT).map((finding) => ({ ...finding, rule: "write-in-compute" })),
  ...sourceFiles(join(ROOT, "test")).flatMap(checkTestSize),
  ...OUTSIDE_TEST.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap(checkPlacement),
];
const byRule = new Map<string, Violation[]>();
for (const violation of violations) {
  byRule.set(violation.rule, [...(byRule.get(violation.rule) ?? []), violation]);
}

if (violations.length === 0) {
  console.log("source rules: ok");
} else {
  for (const [rule, list] of byRule) {
    console.error(`${rule}: ${list.length}`);
    if (Bun.argv.includes("--list")) {
      for (const { file, line } of list) console.error(`  ${file}:${line}`);
    }
  }
  process.exit(1);
}
