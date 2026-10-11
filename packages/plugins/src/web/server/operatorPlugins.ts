import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifest } from "@slock/core";
import { BUILTIN_PLUGINS_DIR, OPERATOR_PLUGINS_DIR } from "@slock/server/pluginDirs";

const CLIENT_FILE = "client/index.js";
const SERVER_ENTRIES = ["server/index.ts", "server/index.js"];
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

export type ClientPluginListing = Manifest & { url: string };
export type PluginListing = { instance: ClientPluginListing[]; serverOnly: Manifest[] };

function manifestsIn(dir: string): Promise<{ root: string; manifest: Manifest }[]> {
  if (!existsSync(dir)) return Promise.resolve([]);
  const paths = [...new Bun.Glob("*/plugin.json").scanSync({ cwd: dir })].sort();
  return Promise.all(
    paths.map(async (path) => ({
      manifest: await Bun.file(resolve(dir, path)).json(),
      root: resolve(dir, path, ".."),
    })),
  );
}

function hasServer(root: string): boolean {
  return SERVER_ENTRIES.some((entry) => existsSync(resolve(root, entry)));
}

export async function listPlugins(): Promise<PluginListing> {
  const builtin = await manifestsIn(BUILTIN_PLUGINS_DIR);
  const operator = await manifestsIn(OPERATOR_PLUGINS_DIR);
  const instance = operator
    .filter(({ root }) => existsSync(resolve(root, CLIENT_FILE)))
    .map(({ manifest }) => ({ ...manifest, url: `/plugins/${manifest.id}/client.js` }));
  const serverOnly = [
    ...builtin.filter(({ root }) => !existsSync(resolve(root, "client"))),
    ...operator.filter(({ root }) => !existsSync(resolve(root, CLIENT_FILE))),
  ]
    .filter(({ root }) => hasServer(root))
    .map(({ manifest }) => manifest)
    .filter((manifest) => !manifest.hidden);
  return { instance, serverOnly };
}

export function operatorPluginFile(pathname: string): string | undefined {
  const [, , id, file] = pathname.split("/");
  if (!(id && SAFE_ID.test(id)) || file !== "client.js") return;
  const path = resolve(OPERATOR_PLUGINS_DIR, id, CLIENT_FILE);
  return existsSync(path) ? path : undefined;
}
