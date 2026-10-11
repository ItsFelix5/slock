import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifest, PluginDef } from "@slock/core";
import { isRecord } from "@slock/core";
import { BUILTIN_PLUGINS_DIR, OPERATOR_PLUGINS_DIR } from "./pluginDirs.ts";

const SERVER_ENTRIES = ["server/index.ts", "server/index.js"];

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function manifestOf(path: string): Promise<Manifest> {
  const parsed: unknown = await Bun.file(path).json();
  if (!(isRecord(parsed) && typeof parsed.id === "string")) throw new Error(`${path} has no id`);
  return {
    core: parsed.core === true ? true : undefined,
    hidden: parsed.hidden === true ? true : undefined,
    defaultEnabled: parsed.defaultEnabled === false ? false : undefined,
    id: parsed.id,
    provides: stringList(parsed.provides),
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    requires: stringList(parsed.requires),
  };
}

async function discoverIn(dir: string): Promise<PluginDef[]> {
  if (!existsSync(dir)) return [];
  const found: PluginDef[] = [];
  const manifests = [...new Bun.Glob("*/plugin.json").scanSync({ cwd: dir })].sort();
  for (const manifestPath of manifests) {
    const root = resolve(dir, manifestPath, "..");
    const entry = SERVER_ENTRIES.map((name) => resolve(root, name)).find(
      (path) => Bun.file(path).size > 0,
    );
    if (entry)
      found.push({ ...(await manifestOf(resolve(dir, manifestPath))), load: () => import(entry) });
  }
  return found;
}

export async function discoverServerPlugins(): Promise<PluginDef[]> {
  const found = [
    ...(await discoverIn(BUILTIN_PLUGINS_DIR)),
    ...(await discoverIn(OPERATOR_PLUGINS_DIR)),
  ];
  const ids = new Set(found.flatMap((plugin) => [plugin.id, ...(plugin.provides ?? [])]));
  return found.map((plugin) => ({
    ...plugin,
    requires: plugin.requires?.filter((id) => ids.has(id)),
  }));
}
