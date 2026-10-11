import { planStart } from "./plan";
import { createRegistry } from "./registry";
import type { Context, EnabledStore, PluginDef, PluginStatus, Reactive, Setup } from "./types";

const CORE_NAMES = new Set(["root", "http", "ws", "cli"]);

const plainReactive: Reactive = {
  scope: (fn) => ({ dispose: () => {}, value: fn() }),
  signal: (initial) => {
    let current = initial;
    return [
      () => current,
      (value) => {
        current = value;
      },
    ];
  },
  untrack: (fn) => fn(),
};

export class Unavailable extends Error {}

type Running = { cleanups: (() => void)[]; dispose: () => void };

export type HostOptions = {
  plugins?: PluginDef[];
  reactive?: Reactive;
  enabled?: EnabledStore;
  beforeRestart?: () => void;
};

export type PluginInfo = {
  id: string;
  core: boolean;
  hidden: boolean;
  dependents: string[];
  name: string;
  requires: readonly string[];
  enabled: boolean;
  status: PluginStatus;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createHost(options: HostOptions = {}) {
  const reactive = options.reactive ?? plainReactive;
  const registry = createRegistry(reactive);
  const defs = new Map<string, PluginDef>();
  const running = new Map<string, Running>();
  const failed = new Map<string, string>();
  const unavailable = new Set<string>();
  const setups = new Map<string, Promise<Setup>>();
  const [overrides, setOverrides] = reactive.signal<Record<string, boolean>>(
    options.enabled?.read() ?? {},
  );
  const [statuses, setStatuses] = reactive.signal<Record<string, PluginStatus>>({});
  const [defsVersion, setDefsVersion] = reactive.signal(0);
  let defsRevision = 0;
  let queue: Promise<void> = Promise.resolve();

  function resolveId(id: string): string | undefined {
    if (defs.has(id)) return id;
    for (const def of defs.values()) if (def.provides?.includes(id)) return def.id;
  }

  function isEnabled(id: string): boolean {
    return overrides()[id] ?? defs.get(id)?.defaultEnabled !== false;
  }

  const plan = () => planStart({ defs, failed, isEnabled, resolveId });

  function publish(blocked: Map<string, string>) {
    const next: Record<string, PluginStatus> = {};
    for (const id of defs.keys()) {
      const error = failed.get(id);
      if (running.has(id)) next[id] = { state: "running" };
      else if (error !== undefined)
        next[id] = { error, state: unavailable.has(id) ? "blocked" : "failed" };
      else if (blocked.has(id)) next[id] = { error: blocked.get(id), state: "blocked" };
      else next[id] = { state: "off" };
    }
    setStatuses(next);
  }

  function createContext(def: PluginDef, cleanups: (() => void)[]): Context {
    const required = new Set(def.requires);
    function check(name: string) {
      const owner = name.split(".")[0] ?? name;
      if (owner === def.id || required.has(owner) || CORE_NAMES.has(owner) || !resolveId(owner))
        return;
      console.warn(`plugin ${def.id} uses ${name} but does not require ${owner}`);
    }
    return {
      add: (point, item, addOptions) => {
        registry.add(def.id, point, item, addOptions);
      },
      get: (key) => {
        check(String(key));
        const service = reactive.untrack(() => registry.service(key));
        if (service === undefined) throw new Error(`${def.id}: service ${String(key)} is missing`);
        return service;
      },
      id: def.id,
      maybe: (key) => () => registry.service(key),
      onCleanup: (fn) => {
        cleanups.push(fn);
      },
      provide: (key, service) => registry.provide(def.id, key, service),
      use: (point) => () => registry.items(point),
    };
  }

  function setupOf(def: PluginDef): Promise<Setup> {
    let loaded = setups.get(def.id);
    if (!loaded) {
      loaded = "setup" in def ? Promise.resolve(def.setup) : def.load().then((mod) => mod.default);
      setups.set(def.id, loaded);
    }
    return loaded;
  }

  async function startOne(def: PluginDef) {
    const cleanups: (() => void)[] = [];
    let dispose = () => {};
    try {
      const setup = await setupOf(def);
      const { dispose: disposeScope, value } = reactive.scope(() =>
        setup(createContext(def, cleanups)),
      );
      dispose = disposeScope;
      await value;
      running.set(def.id, { cleanups, dispose });
    } catch (error) {
      if (error instanceof Unavailable) unavailable.add(def.id);
      else console.error(`plugin ${def.id} failed to start`, error);
      teardown(cleanups, dispose);
      registry.removeOwner(def.id);
      setups.delete(def.id);
      failed.set(def.id, errorText(error));
    }
  }

  function teardown(cleanups: (() => void)[], dispose: () => void) {
    for (const cleanup of cleanups.toReversed()) {
      try {
        cleanup();
      } catch (error) {
        console.error("plugin cleanup failed", error);
      }
    }
    dispose();
  }

  function stopOne(id: string) {
    const entry = running.get(id);
    if (!entry) return;
    running.delete(id);
    teardown(entry.cleanups, entry.dispose);
    registry.removeOwner(id);
  }

  function dependsOn(id: string, target: string, seen = new Set<string>()): boolean {
    if (seen.has(id)) return false;
    seen.add(id);
    return (defs.get(id)?.requires ?? []).some((name) => {
      const required = resolveId(name);
      return required === target || (!!required && dependsOn(required, target, seen));
    });
  }

  function stopWithDependents(id: string) {
    for (const other of [...running.keys()].reverse()) if (dependsOn(other, id)) stopOne(other);
    stopOne(id);
  }

  async function reconcileNow() {
    for (;;) {
      const { blocked, order } = plan();
      const wanted = new Set(order);
      for (const id of [...running.keys()].reverse()) if (!wanted.has(id)) stopOne(id);
      const pending = order.filter((id) => !running.has(id));
      const [next] = pending;
      if (!next) {
        publish(blocked);
        return;
      }
      for (const id of pending) {
        const def = defs.get(id);
        if (def) void setupOf(def).catch(() => {});
      }
      const def = defs.get(next);
      if (def) await startOne(def);
    }
  }

  function enqueue(task: () => void | Promise<void>): Promise<void> {
    queue = queue.then(task, task);
    return queue;
  }

  function stopAll() {
    for (const id of [...running.keys()].reverse()) stopOne(id);
  }

  return {
    add: registry.add,
    idle: (): Promise<void> => enqueue(() => {}),
    items: registry.items,
    list(): PluginInfo[] {
      void defsVersion();
      const current = statuses();
      void overrides();
      return [...defs.values()].map((def) => ({
        core: def.core === true,
        hidden: def.hidden === true,
        dependents: [...defs.keys()].filter((other) => dependsOn(other, def.id)),
        enabled: isEnabled(def.id),
        id: def.id,
        name: def.name ?? def.id,
        requires: def.requires ?? [],
        status: current[def.id] ?? { state: "off" },
      }));
    },
    register(...added: PluginDef[]): Promise<void> {
      return enqueue(() => {
        for (const def of added) {
          stopWithDependents(def.id);
          setups.delete(def.id);
          failed.delete(def.id);
          defs.set(def.id, def);
        }
        setDefsVersion(++defsRevision);
        return reconcileNow();
      });
    },
    restart(): Promise<void> {
      return enqueue(async () => {
        stopAll();
        options.beforeRestart?.();
        failed.clear();
        unavailable.clear();
        await reconcileNow();
      });
    },
    service: registry.service,
    setEnabled(id: string, on: boolean): Promise<void> {
      const next = { ...overrides(), [id]: on };
      setOverrides(next);
      options.enabled?.write(next);
      failed.delete(id);
      return enqueue(reconcileNow);
    },
    start(): Promise<void> {
      return enqueue(reconcileNow);
    },
    stop(): Promise<void> {
      return enqueue(stopAll);
    },
    unregister(id: string): Promise<void> {
      return enqueue(() => {
        stopOne(id);
        defs.delete(id);
        failed.delete(id);
        setups.delete(id);
        setDefsVersion(++defsRevision);
        return reconcileNow();
      });
    },
  };
}

export type Host = ReturnType<typeof createHost>;
