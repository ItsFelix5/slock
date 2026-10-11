import type { PluginDef, Setup } from "@slock/core";
import { getHost } from "@slock/core/solid";
import { createSignal, lazy } from "solid-js";
import { definitionFromSource, setupOf } from "./data/loadPlugin";
import { listStoredPlugins, removeStoredPlugin, saveStoredPlugin } from "./data/userPluginStore";

const view = lazy(() => import("./views/PluginsTab"));

type Listing = { id: string; name?: string; requires?: string[]; url: string };
type ServerOnly = { id: string; name?: string };
type OperatorListing = { instance: Listing[]; serverOnly: ServerOnly[] };

async function fetchListing(): Promise<OperatorListing> {
  const response = await fetch("/api/plugins");
  if (!response.ok) return { instance: [], serverOnly: [] };
  return response.json();
}

function operatorDefinitions(instance: Listing[]): PluginDef[] {
  return instance.map(({ url, ...manifest }) => ({
    ...manifest,
    load: async () => ({ default: setupOf(await import(url)) }),
  }));
}

function failedDefinition(id: string, name: string, error: unknown): PluginDef {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id,
    name,
    setup: () => {
      throw new Error(message);
    },
  };
}

const setup: Setup = (ctx) => {
  const host = getHost();
  const [installed, setInstalled] = createSignal<string[]>([]);
  const [serverOnly, setServerOnly] = createSignal<ServerOnly[]>([]);
  const registered = new Set<string>();

  async function register(def: PluginDef) {
    registered.add(def.id);
    await host.register(def);
  }

  async function install(file: File) {
    const code = await file.text();
    const def = await definitionFromSource(code);
    if (host.list().some((plugin) => plugin.id === def.id && !installed().includes(def.id))) {
      throw new Error(`A plugin named ${def.id} already exists.`);
    }
    await saveStoredPlugin({ code, id: def.id, name: def.name ?? def.id });
    setInstalled((ids) => [...new Set([...ids, def.id])]);
    await register(def);
  }

  async function remove(id: string) {
    await removeStoredPlugin(id);
    setInstalled((ids) => ids.filter((item) => item !== id));
    registered.delete(id);
    await host.unregister(id);
  }

  async function loadAll() {
    const stored = await listStoredPlugins();
    setInstalled(stored.map((plugin) => plugin.id));
    const userDefs = await Promise.all(
      stored.map((plugin) =>
        definitionFromSource(plugin.code).catch((error) =>
          failedDefinition(plugin.id, plugin.name, error),
        ),
      ),
    );
    const listing = await fetchListing().catch(() => ({ instance: [], serverOnly: [] }));
    const operatorDefs = operatorDefinitions(listing.instance);
    setServerOnly(listing.serverOnly);
    for (const def of [...operatorDefs, ...userDefs]) registered.add(def.id);
    await host.register(...operatorDefs, ...userDefs);
  }

  ctx.provide("plugins", { install, installed, remove, serverOnly });
  ctx.add("settings.tab", { id: "plugins", label: "Plugins", view }, { order: 80 });
  ctx.onCleanup(() => {
    for (const id of registered) void host.unregister(id);
  });
  void loadAll();
};

export default setup;
