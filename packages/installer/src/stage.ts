import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileUnit, packageName } from "./compile";
import { libSpecifiers } from "./libs";
import type { Candidate, Session } from "./sources";

export type Staged = { candidate: Candidate; dir: string; dependencies: Record<string, string> };

const PROVIDED_PACKAGES = /^(@slock\/|@solidjs\/web$|solid-js$)/;

function nearestDependencies(from: string): Record<string, string> {
  for (let dir = from; ; dir = dirname(dir)) {
    const path = join(dir, "package.json");
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")).dependencies ?? {};
    if (dirname(dir) === dir) return {};
  }
}

export async function stage(candidate: Candidate, session: Session): Promise<Staged> {
  const dir = join(session.tmp, "stage", candidate.manifest.id);
  const specifiers = await compileUnit(candidate.dir, dir);
  const known = nearestDependencies(candidate.dir);
  const dependencies: Record<string, string> = {};
  for (const specifier of specifiers) {
    const name = packageName(specifier);
    if (PROVIDED_PACKAGES.test(name) || libSpecifiers.includes(specifier)) continue;
    const range = known[name];
    if (!range)
      throw new Error(`${candidate.manifest.id} imports ${name} but package.json does not list it`);
    dependencies[name] = range;
  }
  return { candidate, dependencies, dir };
}
