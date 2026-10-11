import type { AddOptions, Points, Reactive, Services } from "./types";

type Entry = { owner: string; id?: string; order: number; seq: number; item: unknown };
type Cell<T> = { value: T; read: () => number; bump: () => void };
type PointCell = Cell<Entry[]> & { sorted?: unknown[] };
type ServiceCell = Cell<{ owner: string; service: unknown } | undefined>;

function sortEntries(entries: Entry[]): unknown[] {
  const latestById = new Map<string, Entry>();
  for (const entry of entries) if (entry.id !== undefined) latestById.set(entry.id, entry);
  return entries
    .filter((entry) => entry.id === undefined || latestById.get(entry.id) === entry)
    .sort((a, b) => a.order - b.order || a.seq - b.seq)
    .map((entry) => entry.item);
}

export function createRegistry(reactive: Reactive) {
  const points = new Map<string, PointCell>();
  const services = new Map<string, ServiceCell>();
  let seq = 0;

  function createCell<T>(value: T): Cell<T> {
    const [read, set] = reactive.signal(0);
    let version = 0;
    return { bump: () => set(++version), read, value };
  }

  function pointCell(point: string): PointCell {
    const found = points.get(point);
    if (found) return found;
    const created: PointCell = createCell<Entry[]>([]);
    points.set(point, created);
    return created;
  }

  function serviceCell(key: string): ServiceCell {
    const found = services.get(key);
    if (found) return found;
    const created: ServiceCell = createCell<{ owner: string; service: unknown } | undefined>(
      undefined,
    );
    services.set(key, created);
    return created;
  }

  function add<P extends keyof Points>(
    owner: string,
    point: P,
    item: Points[P],
    options: AddOptions = {},
  ) {
    const target = pointCell(point);
    target.value.push({ id: options.id, item, order: options.order ?? 0, owner, seq: ++seq });
    target.sorted = undefined;
    target.bump();
  }

  function items<P extends keyof Points>(point: P): Points[P][] {
    const target = pointCell(point);
    target.read();
    target.sorted ??= sortEntries(target.value);
    return target.sorted as Points[P][];
  }

  function provide<K extends keyof Services>(owner: string, key: K, service: Services[K]) {
    const target = serviceCell(key);
    target.value = { owner, service };
    target.bump();
  }

  function service<K extends keyof Services>(key: K): Services[K] | undefined {
    const target = serviceCell(key);
    target.read();
    return target.value?.service as Services[K] | undefined;
  }

  function removeOwner(owner: string) {
    for (const target of points.values()) {
      if (!target.value.some((entry) => entry.owner === owner)) continue;
      target.value = target.value.filter((entry) => entry.owner !== owner);
      target.sorted = undefined;
      target.bump();
    }
    for (const target of services.values()) {
      if (target.value?.owner !== owner) continue;
      target.value = undefined;
      target.bump();
    }
  }

  function owned(owner: string): number {
    let count = 0;
    for (const target of points.values())
      count += target.value.filter((entry) => entry.owner === owner).length;
    for (const target of services.values()) if (target.value?.owner === owner) count++;
    return count;
  }

  return { add, items, owned, provide, removeOwner, service };
}

export type Registry = ReturnType<typeof createRegistry>;
