import type { Component } from "solid-js";

export type TimerHandle = { readonly cancel: () => void };

export type Env = {
  now(): number;
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle | undefined): void;
  setInterval(callback: () => void, ms: number): TimerHandle;
  clearInterval(handle: TimerHandle | undefined): void;
  random(): number;
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    subscribe(listener: (key: string | null) => void): () => void;
  };
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export interface Services {
  env: Env;
}

export interface Points {
  root: Component;
}

export type AddOptions = { id?: string; order?: number };

export type Context = {
  readonly id: string;
  provide<K extends keyof Services>(key: K, service: Services[K]): void;
  get<K extends keyof Services>(key: K): Services[K];
  maybe<K extends keyof Services>(key: K): () => Services[K] | undefined;
  add<P extends keyof Points>(point: P, item: Points[P], options?: AddOptions): void;
  use<P extends keyof Points>(point: P): () => Points[P][];
  onCleanup(fn: () => void): void;
};

export type Setup = (ctx: Context) => void | Promise<void>;

export type Manifest = {
  id: string;
  name?: string;
  requires?: readonly string[];
  provides?: readonly string[];
  defaultEnabled?: boolean;
  core?: boolean;
  hidden?: boolean;
};

export type PluginDef = Manifest & ({ setup: Setup } | { load: () => Promise<{ default: Setup }> });

export type PluginState = "off" | "running" | "failed" | "blocked";

export type PluginStatus = { state: PluginState; error?: string };

export type Reactive = {
  signal<T>(initial: T): [() => T, (value: T) => void];
  scope<T>(fn: () => T): { value: T; dispose: () => void };
  untrack<T>(fn: () => T): T;
};

export type EnabledStore = {
  read(): Record<string, boolean>;
  write(overrides: Record<string, boolean>): void;
};
