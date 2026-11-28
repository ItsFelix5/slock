import { existsSync, watch } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PluginDef } from "@slock/core";
import { definitionMeta, providedIds } from "./bootModule";
import { type Base, buildBase, type ClientBuild, linkClient } from "./client";
import { PACKAGES, PLUGINS_SRC, PUBLIC_DIR, REPO } from "./paths";
import { openSession, resolveSpec } from "./sources";
import { halvesOf, readUnits, type Unit, unitInfo } from "./units";

export type { ClientBuild } from "./client";

async function devUnits(): Promise<Unit[]> {
  const session = await openSession();
  try {
    const listed = await resolveSpec({ kind: "id", off: false, value: "core" }, REPO, session);
    const on = new Set(listed.filter(({ off }) => !off).map(({ manifest }) => manifest.id));
    return (await readUnits(PLUGINS_SRC)).map((unit) => ({
      ...unit,
      meta: { ...unit.meta, off: !(unit.manifest.hidden || on.has(unit.manifest.id)) },
    }));
  } finally {
    await session.cleanup();
  }
}

export async function devServerOptions() {
  const units = await devUnits();
  const withServer = units.flatMap((unit) => {
    const { serverEntry } = halvesOf(unit.dir);
    return serverEntry ? [{ entry: serverEntry, unit }] : [];
  });
  const present = providedIds(withServer.map(({ unit }) => unit));
  const plugins: PluginDef[] = withServer.map(({ entry, unit }) => ({
    ...definitionMeta(unit, present),
    load: () => import(entry),
  }));
  return { plugins, units: units.map(unitInfo) };
}

export async function createDevBuild() {
  let base: Promise<Base> | undefined;
  let linked: Promise<ClientBuild> | undefined;
  const reset = (everything: boolean) => {
    linked = undefined;
    if (everything) base = undefined;
  };
  const watchers = (await readdir(PACKAGES))
    .map((name) => ({ dir: join(PACKAGES, name, "src"), name }))
    .filter(({ dir }) => existsSync(dir))
    .map(({ dir, name }) => watch(dir, { recursive: true }, () => reset(name !== "plugins")));
  return {
    close: () => {
      for (const watcher of watchers) watcher.close();
    },
    get: (): Promise<ClientBuild> => {
      base ??= buildBase(false);
      linked ??= base.then(async (built) => linkClient(await devUnits(), built, false));
      return linked.catch((error) => {
        reset(true);
        throw error;
      });
    },
    publicDir: PUBLIC_DIR,
  };
}
