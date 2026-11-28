import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import type { SourceFile } from "./types";

const ROOT = `${import.meta.dir}/../../..`;
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".css",
  ".json",
  ".jsonc",
  ".md",
  ".webmanifest",
  ".txt",
  ".svg",
  ".html",
  ".yaml",
  ".yml",
]);
const IGNORED = /(^|\/)(node_modules|dist)\//;
const PLUGIN_PATH = /^packages\/plugins\/src\/([^/]+)\//;
const PACKAGE_PATH = /^packages\/([^/]+)\//;
const TEST_FILE = /\.test\.tsx?$/;

export function areaOf(path: string): string {
  const plugin = PLUGIN_PATH.exec(path);
  if (plugin) return `plugin:${plugin[1]}`;
  const pkg = PACKAGE_PATH.exec(path);
  if (pkg) return `pkg:${pkg[1]}`;
  return path.includes("/") ? path.slice(0, path.indexOf("/")) : "root";
}

function makeFile(path: string, text: string): SourceFile {
  return { path, text, ext: extname(path), area: areaOf(path), isTest: TEST_FILE.test(path) };
}

function listTracked(): string[] {
  const output = Bun.spawnSync(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: ROOT },
  ).stdout.toString();
  return [...new Set(output.split("\0").filter(Boolean))];
}

export function loadFiles(): SourceFile[] {
  return listTracked()
    .filter((path) => TEXT_EXTENSIONS.has(extname(path)) && !IGNORED.test(path))
    .filter((path) => existsSync(`${ROOT}/${path}`))
    .map((path) => makeFile(path, readFileSync(`${ROOT}/${path}`, "utf8")));
}

export function isSource(file: SourceFile): boolean {
  return file.ext === ".ts" || file.ext === ".tsx";
}

export function lineCount(text: string): number {
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}
