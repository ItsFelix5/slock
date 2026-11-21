import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { BunPlugin } from "bun";

const PLUGIN_SPECIFIER = /^@slock\/plugins\//;
const RELATIVE = /^\.{1,2}\//;
const SCRIPT_EXTENSION = /\.tsx?$/;
const EXTENSIONS = [".ts", ".tsx", ".js"];

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

function candidates(base: string): string[] {
  const swapped = SCRIPT_EXTENSION.test(base) ? [base.replace(SCRIPT_EXTENSION, ".js")] : [];
  return [
    base,
    ...swapped,
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ];
}

export function resolveFile(base: string): string | undefined {
  return candidates(base).find(isFile);
}

export function unitResolver(roots: Map<string, string>): BunPlugin {
  const unitRoots = [...roots.values()];
  return {
    name: "unit-resolver",
    setup(build) {
      build.onResolve({ filter: PLUGIN_SPECIFIER }, ({ path }) => {
        const [id, ...rest] = path.replace(PLUGIN_SPECIFIER, "").split("/");
        const root = roots.get(id ?? "");
        if (!root) throw new Error(`${path}: plugin ${id} is not installed`);
        const file = resolveFile(join(root, ...rest));
        if (!file) throw new Error(`${path} does not exist in plugin ${id}`);
        return { path: file };
      });
      build.onResolve({ filter: RELATIVE }, ({ importer, path }) => {
        if (!unitRoots.some((root) => importer.startsWith(root))) return;
        const base = resolve(dirname(importer), path);
        return isFile(base) ? undefined : { path: resolveFile(base) ?? base };
      });
    },
  };
}
