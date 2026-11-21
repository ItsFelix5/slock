import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { type Manifest, readManifest } from "@slock/core";

export type UnitMeta = {
  source: string;
  from: string;
  commit: string;
  slock: string;
  off: boolean;
  dependencies: Record<string, string>;
};

export type Unit = { manifest: Manifest; meta: UnitMeta; dir: string };

export type Halves = { clientDir: boolean; clientEntry?: string; serverEntry?: string };

const ENTRY_NAMES = ["index.js", "index.ts", "index.tsx"];
const MANIFEST = "plugin.json";

export const SOURCE_META: UnitMeta = {
  commit: "dev",
  dependencies: {},
  from: "",
  off: false,
  slock: "dev",
  source: "source",
};

function entryIn(dir: string): string | undefined {
  const found = ENTRY_NAMES.map((name) => join(dir, name)).find((path) => existsSync(path));
  return found && Bun.file(found).size > 0 ? found : undefined;
}

export function halvesOf(dir: string): Halves {
  const clientDir = join(dir, "client");
  return {
    clientDir: existsSync(clientDir),
    clientEntry: entryIn(clientDir),
    serverEntry: entryIn(join(dir, "server")),
  };
}

export async function readUnit(dir: string): Promise<Unit> {
  const path = join(dir, MANIFEST);
  const raw = await Bun.file(path).json();
  const { install, ...rest } = raw;
  return {
    dir,
    manifest: readManifest(rest, path),
    meta: { ...SOURCE_META, ...install },
  };
}

export async function readUnits(root: string): Promise<Unit[]> {
  if (!existsSync(root)) return [];
  const names = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, MANIFEST)))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(names.map((name) => readUnit(join(root, name))));
}

export async function writeUnitManifest(unit: Unit): Promise<void> {
  const { boot, hidden, id, name, provides, requires } = unit.manifest;
  const manifest = { boot, hidden, id, install: unit.meta, name, provides, requires };
  await Bun.write(join(unit.dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function unitInfo({ manifest, meta, dir }: Unit) {
  const { clientDir, clientEntry, serverEntry } = halvesOf(dir);
  return {
    ...manifest,
    client: clientDir || clientEntry !== undefined,
    off: meta.off,
    server: serverEntry !== undefined,
    source: meta.source,
  };
}
