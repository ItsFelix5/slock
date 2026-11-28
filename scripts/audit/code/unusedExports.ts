import type { Rule, SourceFile, Violation } from "../lib/types";
import { readModules } from "./moduleGraph";

const ids = ["unused-export"];

const ENTRY_DEFAULT = /^packages\/plugins\/src\/[^/]+\/(?:client|server)\/index\.tsx?$/;
const ENTRY_ALL_EXPORTS = /^examplePlugin\/(?:client|server)\/index\.tsx?$/;
const ENTRY_FILES = new Set(["packages/core/src/client/boot.tsx", "packages/central/src/index.ts"]);

function check(files: SourceFile[]): Violation[] {
  const modules = readModules(files);
  const byPath = new Map(modules.map((info) => [info.file.path, info]));
  const used = new Set<string>();
  const wholeUsed = new Set<string>();
  const mark = (path: string, name: string) => {
    const key = `${path}\0${name}`;
    if (used.has(key)) return;
    used.add(key);
    const info = byPath.get(path);
    if (!info) return;
    const reexport = info.declared.find((declared) => declared.name === name)?.from;
    if (reexport) mark(reexport.path, reexport.name);
    for (const star of info.stars) mark(star, name);
  };
  const markWhole = (path: string) => {
    if (wholeUsed.has(path)) return;
    wholeUsed.add(path);
    const info = byPath.get(path);
    if (!info) return;
    for (const declared of info.declared) mark(path, declared.name);
    for (const star of info.stars) markWhole(star);
  };
  for (const info of modules) {
    for (const use of info.uses) mark(use.path, use.name);
    for (const path of info.wholeModules) markWhole(path);
  }
  const found: Violation[] = [];
  for (const info of modules) {
    if (info.file.isTest || ENTRY_FILES.has(info.file.path)) continue;
    if (ENTRY_ALL_EXPORTS.test(info.file.path)) continue;
    for (const declared of info.declared) {
      const isEntryDefault = declared.name === "default" && ENTRY_DEFAULT.test(info.file.path);
      if (isEntryDefault || used.has(`${info.file.path}\0${declared.name}`)) continue;
      found.push({
        rule: "unused-export",
        path: info.file.path,
        line: declared.line,
        message: `${declared.from ? "re-export" : "export"} ${declared.name} is never imported`,
      });
    }
  }
  return found;
}

export const unusedExportsRule: Rule = { group: "unused", ids, check };
