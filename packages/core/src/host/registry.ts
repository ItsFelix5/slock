import type { AddOptions, Points, Reactive, Services } from "../types";

type Entry<T> = { owner: string; id?: string; order: number; seq: number; item: T };

function sortEntries<T>(entries: Entry<T>[]): T[] {
  const latestById = new Map<string, Entry<T>>();
  for (const entry of entries) if (entry.id !== undefined) latestById.set(entry.id, entry);
  return entries
    .filter((entry) => entry.id === undefined || latestById.get(entry.id) === entry)
    .sort((a, b) => a.order - b.order || a.seq - b.seq)
    .map((entry) => entry.item);
}

function createVersion(reactive: Reactive) {
  const [read, set] = reactive.signal(0);
  let version = 0;
  return { bump: () => set(++version), read };
}

function createPointCell<T>(reactive: Reactive) {
  const version = createVersion(reactive);
  let entries: Entry<T>[] = [];
  let sorted: T[] | undefined;
  return {
    add(entry: Entry<T>) {
      entries.push(entry);
      sorted = undefined;
      version.bump();
    },
    items(): T[] {
      version.read();
      sorted ??= sortEntries(entries);
      return sorted;
    },
    owned: (owner: string) => entries.filter((entry) => entry.owner === owner).length,
    removeOwner(owner: string) {
      if (!entries.some((entry) => entry.owner === owner)) return;
      entries = entries.filter((entry) => entry.owner !== owner);
      sorted = undefined;
      version.bump();
    },
  };
}

function createServiceCell<T>(reactive: Reactive) {
  const version = createVersion(reactive);
  let current: { owner: string; service: T } | undefined;
  return {
    get(): T | undefined {
      version.read();
      return current?.service;
    },
    owned: (owner: string) => (current?.owner === owner ? 1 : 0),
    removeOwner(owner: string) {
      if (current?.owner !== owner) return;
      current = undefined;
      version.bump();
    },
    set(owner: string, service: T) {
      current = { owner, service };
      version.bump();
    },
  };
}

export function createRegistry(reactive: Reactive) {
  const points: { [P in keyof Points]?: ReturnType<typeof createPointCell<Points[P]>> } = {};
  const services: { [K in keyof Services]?: ReturnType<typeof createServiceCell<Services[K]>> } =
    {};
  let seq = 0;

  function pointCell<P extends keyof Points>(point: P) {
    const found = points[point];
    if (found) return found;
    const created = createPointCell<Points[P]>(reactive);
    Object.assign(points, { [point]: created });
    return created;
  }

  function serviceCell<K extends keyof Services>(key: K) {
    const found = services[key];
    if (found) return found;
    const created = createServiceCell<Services[K]>(reactive);
    Object.assign(services, { [key]: created });
    return created;
  }

  function add<P extends keyof Points>(
    owner: string,
    point: P,
    item: Points[P],
    options: AddOptions = {},
  ) {
    pointCell(point).add({ id: options.id, item, order: options.order ?? 0, owner, seq: ++seq });
  }

  function items<P extends keyof Points>(point: P): Points[P][] {
    return pointCell(point).items();
  }

  function provide<K extends keyof Services>(owner: string, key: K, service: Services[K]) {
    serviceCell(key).set(owner, service);
  }

  function service<K extends keyof Services>(key: K): Services[K] | undefined {
    return serviceCell(key).get();
  }

  function removeOwner(owner: string) {
    for (const cell of Object.values(points)) cell?.removeOwner(owner);
    for (const cell of Object.values(services)) cell?.removeOwner(owner);
  }

  function owned(owner: string): number {
    let count = 0;
    for (const cell of Object.values(points)) count += cell?.owned(owner) ?? 0;
    for (const cell of Object.values(services)) count += cell?.owned(owner) ?? 0;
    return count;
  }

  return { add, items, owned, provide, removeOwner, service };
}
