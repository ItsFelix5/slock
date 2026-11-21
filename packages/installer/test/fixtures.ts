import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readManifest } from "@slock/core";
import type { Candidate } from "../src/sources";
import type { Unit } from "../src/units";

export function writePlugin(
  root: string,
  id: string,
  extra: Record<string, unknown> = {},
  files: Record<string, string> = {},
): string {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plugin.json"), JSON.stringify({ id, name: id, requires: [], ...extra }));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }
  return dir;
}

const manifestIn = (dir: string) =>
  readManifest(JSON.parse(readFileSync(join(dir, "plugin.json"), "utf8")), dir);

export function unitOf(dir: string, commit = "abc"): Unit {
  return {
    dir,
    manifest: manifestIn(dir),
    meta: { commit, dependencies: {}, from: dir, off: false, slock: "s", source: dir },
  };
}

export function candidateOf(dir: string, commit = "abc"): Candidate {
  return { commit, dir, from: dir, manifest: manifestIn(dir), off: false, source: dir };
}
