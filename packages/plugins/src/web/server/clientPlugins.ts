import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifest } from "@slock/core";
import type { BunPlugin } from "bun";

const PLUGINS_DIR = resolve(import.meta.dir, "../..");
const CLIENT_ENTRIES = ["client/index.tsx", "client/index.ts"];
const VIRTUAL_ID = "virtual:plugins";
const VIRTUAL_FILTER = /^virtual:plugins$/;
const ANY_FILTER = /.*/;

type ClientPlugin = { entry?: string; manifest: Manifest };

async function discoverClientPlugins(): Promise<ClientPlugin[]> {
  const found: ClientPlugin[] = [];
  const manifests = [...new Bun.Glob("*/plugin.json").scanSync({ cwd: PLUGINS_DIR })].sort();
  for (const manifestPath of manifests) {
    const root = resolve(PLUGINS_DIR, manifestPath, "..");
    const entry = CLIENT_ENTRIES.map((name) => resolve(root, name)).find((path) =>
      existsSync(path),
    );
    if (entry || existsSync(resolve(root, "client")))
      found.push({ entry, manifest: await Bun.file(resolve(PLUGINS_DIR, manifestPath)).json() });
  }
  return found;
}

async function pluginsModule(): Promise<string> {
  const found = await discoverClientPlugins();
  const ids = new Set(found.flatMap(({ manifest }) => [manifest.id, ...(manifest.provides ?? [])]));
  const defs: string[] = [];
  for (const { entry, manifest: declared } of found) {
    const manifest = { ...declared, requires: declared.requires?.filter((id) => ids.has(id)) };
    const meta = JSON.stringify(manifest);
    if (entry) {
      defs.push(`{ ...${meta}, load: () => import(${JSON.stringify(entry)}) }`);
    } else {
      defs.push(`{ ...${meta}, setup: () => {} }`);
    }
  }
  return `export default [\n${defs.join(",\n")}\n];\n`;
}

export const clientPluginsPlugin: BunPlugin = {
  name: "client-plugins",
  setup(build) {
    build.onResolve({ filter: VIRTUAL_FILTER }, () => ({
      namespace: "slock",
      path: VIRTUAL_ID,
    }));
    build.onLoad({ filter: ANY_FILTER, namespace: "slock" }, async () => ({
      contents: await pluginsModule(),
      loader: "js",
    }));
  },
};
