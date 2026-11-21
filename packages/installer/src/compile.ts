import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { compileSolid } from "./solid";

const SKIPPED_DIRS = new Set(["node_modules", "test", "tests", "dist"]);
const TEST_FILE = /\.test\.[jt]sx?$|\.d\.ts$/;
const SCRIPT = /\.tsx?$/;
const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
const scanner = new Bun.Transpiler({ loader: "js" });
const NON_PACKAGE = /^(node:|bun(:|$)|\.|\/|@slock\/plugins\/)/;

export function packageName(specifier: string): string {
  const [first, second] = specifier.split("/");
  return first?.startsWith("@") ? `${first}/${second}` : (first ?? specifier);
}

export function bareImports(code: string): string[] {
  return scanner
    .scanImports(code)
    .map(({ path }) => path)
    .filter((path) => !NON_PACKAGE.test(path));
}

async function compileFile(from: string, to: string): Promise<string[]> {
  const source = await Bun.file(from).text();
  const js = from.endsWith(".tsx") ? await compileSolid(source, from) : source;
  const code = transpiler.transformSync(js);
  await Bun.write(to.replace(SCRIPT, ".js"), code);
  return bareImports(code);
}

async function compileDir(from: string, to: string, imports: Set<string>): Promise<void> {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) await compileDir(source, target, imports);
    } else if (SCRIPT.test(entry.name)) {
      if (!TEST_FILE.test(entry.name))
        for (const name of await compileFile(source, target)) imports.add(name);
    } else {
      await cp(source, target);
    }
  }
}

export async function compileUnit(from: string, to: string): Promise<string[]> {
  const imports = new Set<string>();
  await compileDir(from, to, imports);
  return [...imports].sort();
}
