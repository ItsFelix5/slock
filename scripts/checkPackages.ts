import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dir, "..");
const SOURCE = /\.(ts|tsx|css)$/;
const SKIPPED_DIRS = new Set(["node_modules", "dist", "public"]);
const TOOLING = new Set(["@biomejs/biome", "@types/node", "bun-types", "happy-dom", "typescript"]);
const NON_PACKAGE = /^(node:|bun(:|$)|virtual:)/;
const AUGMENTATION = /declare module\s+["']([^"'.][^"']*)["']/g;
const CSS_IMPORT = /@import\s+["']([^"'.][^"']*)["']/g;

type Workspace = {
  dir: string;
  name: string;
  deps: Set<string>;
  devDeps: Set<string>;
  roots: string[];
};

function packageName(specifier: string): string | undefined {
  if (NON_PACKAGE.test(specifier) || specifier.startsWith(".")) return;
  const [first, second] = specifier.split("/");
  return first?.startsWith("@") ? `${first}/${second}` : first;
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : files(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

function workspace(dir: string, roots: string[]): Workspace {
  const manifest = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"));
  return {
    dir,
    name: manifest.name,
    deps: new Set(Object.keys(manifest.dependencies ?? {})),
    devDeps: new Set(Object.keys(manifest.devDependencies ?? {})),
    roots,
  };
}

function importsOf(file: string): Set<string> {
  const text = readFileSync(file, "utf8");
  const specifiers = file.endsWith(".css")
    ? [...text.matchAll(CSS_IMPORT)].map((match) => match[1] ?? "")
    : [
        ...ts.preProcessFile(text, true, true).importedFiles.map((ref) => ref.fileName),
        ...[...text.matchAll(AUGMENTATION)].map((match) => match[1] ?? ""),
      ];
  return new Set(specifiers.flatMap((specifier) => packageName(specifier) ?? []));
}

const workspaces = [
  ...readdirSync(join(ROOT, "packages")).map((name) =>
    workspace(`packages/${name}`, [`packages/${name}`]),
  ),
  workspace("examplePlugin", ["examplePlugin"]),
  workspace(".", ["scripts", "test"]),
];
const names = new Set(workspaces.map((ws) => ws.name));
const errors: string[] = [];

for (const ws of workspaces) {
  const declared = new Set([...ws.deps, ...ws.devDeps]);
  const inSource = new Set<string>();
  const inTests = new Set<string>();
  for (const root of ws.roots.filter((path) => existsSync(join(ROOT, path)))) {
    for (const file of files(join(ROOT, root))) {
      const isTest = /(^|\/)test\//.test(relative(ROOT, file));
      if (file.endsWith(".tsx")) inSource.add("@solidjs/web");
      for (const name of importsOf(file)) (isTest ? inTests : inSource).add(name);
    }
  }
  const used = new Set([...inSource, ...inTests]);
  const fail = (message: string) => errors.push(`${ws.name}: ${message}`);
  for (const name of used) {
    if (name !== ws.name && !declared.has(name)) fail(`imports ${name} but does not declare it`);
  }
  for (const name of inSource) {
    if (ws.dir !== "." && ws.devDeps.has(name) && !ws.deps.has(name))
      fail(`${name} is used by src, not dev only`);
  }
  for (const name of declared) {
    const peerOfDeclared = name === "solid-js" && declared.has("@solidjs/web");
    if (!(used.has(name) || TOOLING.has(name) || peerOfDeclared)) fail(`${name} is never imported`);
  }
}

function findCycle(): string[] | undefined {
  const edges = new Map(
    workspaces.map((ws) => [ws.name, [...ws.deps].filter((name) => names.has(name))]),
  );
  const visit = (name: string, path: string[]): string[] | undefined => {
    if (path.includes(name)) return [...path.slice(path.indexOf(name)), name];
    for (const next of edges.get(name) ?? []) {
      const cycle = visit(next, [...path, name]);
      if (cycle) return cycle;
    }
  };
  return [...edges.keys()].map((name) => visit(name, [])).find(Boolean);
}

const cycle = findCycle();
if (cycle) errors.push(`dependency cycle: ${cycle.join(" -> ")}`);

for (const ws of workspaces.filter((item) => item.dir.startsWith("packages/"))) {
  const tsconfigPath = join(ROOT, ws.dir, "tsconfig.json");
  if (!existsSync(tsconfigPath)) continue;
  const tsconfig = ts.parseConfigFileTextToJson(tsconfigPath, readFileSync(tsconfigPath, "utf8"));
  if (!tsconfig.config?.compilerOptions?.composite) continue;
  const referenced = new Set<string>(
    (tsconfig.config.references ?? []).map((ref: { path: string }) => ref.path.replace("../", "")),
  );
  const wanted = new Set([...ws.deps].filter((name) => names.has(name)));
  for (const name of wanted) {
    if (!referenced.has(name.replace("@slock/", ""))) {
      errors.push(`${ws.name}: tsconfig is missing a reference to ${name}`);
    }
  }
  for (const path of referenced) {
    if (!wanted.has(`@slock/${path}`))
      errors.push(`${ws.name}: tsconfig references ${path} without depending on it`);
  }
}

for (const error of errors) console.error(error);
if (errors.length === 0) console.log("checkPackages: ok");
else process.exit(1);
