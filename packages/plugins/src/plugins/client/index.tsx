import type { PluginDef, Setup } from "@slock/core";
import { errorMessage } from "@slock/core";
import { getHost, lazyChunk, service } from "@slock/core/solid";
import { createSignal } from "solid-js";
import { definitionFromSource } from "./data/loadPlugin";
import { listStoredPlugins, removeStoredPlugin, saveStoredPlugin } from "./data/userPluginStore";

const view = lazyChunk(() => import("./views/PluginsTab"));
const env = service("env");

type ServerOnly = { id: string; name?: string };

async function fetchServerOnly(): Promise<ServerOnly[]> {
  const response = await env.fetch("/api/plugins");
  if (!response.ok) return [];
  return (await response.json()).serverOnly;
}

function failedDefinition(id: string, name: string, error: unknown): PluginDef {
  const message = errorMessage(error);
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
    setServerOnly(await fetchServerOnly().catch(() => []));
    for (const def of userDefs) registered.add(def.id);
    await host.register(...userDefs);
  }

  ctx.provide("plugins", { install, installed, remove, serverOnly });
  ctx.add("settings.tab", { id: "plugins", label: "Plugins", view }, { order: 80 });
  ctx.onCleanup(() => {
    for (const id of registered) void host.unregister(id);
  });
  void loadAll();
};

export default setup;
