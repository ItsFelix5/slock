import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifest, PluginDef } from "@slock/core";
import { readManifest } from "@slock/core";
import { BUILTIN_PLUGINS_DIR, isShippedBuiltin, OPERATOR_PLUGINS_DIR } from "./pluginDirs.ts";

const SERVER_ENTRIES = ["server/index.ts", "server/index.js"];

export async function manifestOf(path: string): Promise<Manifest> {
  return readManifest(await Bun.file(path).json(), path);
}

async function discoverIn(
  dir: string,
  shipped: (manifest: Manifest) => boolean,
): Promise<PluginDef[]> {
  if (!existsSync(dir)) return [];
  const found: PluginDef[] = [];
  const manifests = [...new Bun.Glob("*/plugin.json").scanSync({ cwd: dir })].sort();
  for (const manifestPath of manifests) {
    const root = resolve(dir, manifestPath, "..");
    const entry = SERVER_ENTRIES.map((name) => resolve(root, name)).find(
      (path) => Bun.file(path).size > 0,
    );
    if (!entry) continue;
    const manifest = await manifestOf(resolve(dir, manifestPath));
    if (shipped(manifest)) found.push({ ...manifest, load: () => import(entry) });
  }
  return found;
}

export async function discoverServerPlugins(): Promise<PluginDef[]> {
  const found = [
    ...(await discoverIn(BUILTIN_PLUGINS_DIR, isShippedBuiltin)),
    ...(await discoverIn(OPERATOR_PLUGINS_DIR, () => true)),
  ];
  const ids = new Set(found.flatMap((plugin) => [plugin.id, ...(plugin.provides ?? [])]));
  return found.map((plugin) => ({
    ...plugin,
    requires: plugin.requires?.filter((id) => ids.has(id)),
  }));
}
