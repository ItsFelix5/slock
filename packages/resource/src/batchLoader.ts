import { type Deferred, deferred } from "./deferred";
import type { ResourceEnv } from "./delay";

export class BatchMissingId extends Error {
  constructor(id: string) {
    super(`batch result has no entry for ${id}`);
    this.name = "BatchMissingId";
  }
}

type BatchResult<T> = ReadonlyMap<string, T> | Readonly<Record<string, T>>;

export interface BatchLoaderOptions<T> {
  delayMs?: number;
  env: Pick<ResourceEnv, "setTimeout">;
  load: (ids: string[]) => Promise<BatchResult<T>>;
  maxBatch?: number;
}

export interface BatchLoader<T> {
  get(id: string): Promise<T>;
}

function isMap<T>(result: BatchResult<T>): result is ReadonlyMap<string, T> {
  return result instanceof Map;
}

export function createBatchLoader<T>(options: BatchLoaderOptions<T>): BatchLoader<T> {
  const maxBatch = options.maxBatch ?? Number.POSITIVE_INFINITY;
  const delayMs = options.delayMs ?? 0;
  const waiting = new Map<string, Deferred<T>>();
  let queue: string[] = [];
  let scheduled = false;

  const settle = (id: string, action: (waiter: Deferred<T>) => void) => {
    const waiter = waiting.get(id);
    waiting.delete(id);
    if (waiter) action(waiter);
  };

  async function runBatch(ids: string[]) {
    const unresolved = new Set(ids);
    try {
      const result = await options.load(ids);
      const values = isMap(result) ? result : new Map(Object.entries(result));
      for (const [id, value] of values)
        if (unresolved.delete(id)) settle(id, (waiter) => waiter.resolve(value));
      for (const id of unresolved) settle(id, (waiter) => waiter.reject(new BatchMissingId(id)));
    } catch (error) {
      for (const id of ids) settle(id, (waiter) => waiter.reject(error));
    }
  }

  function flush() {
    scheduled = false;
    const ids = queue;
    queue = [];
    for (let start = 0; start < ids.length; start += maxBatch)
      void runBatch(ids.slice(start, start + maxBatch));
  }

  return {
    get: (id) => {
      const existing = waiting.get(id);
      if (existing) return existing.promise;
      const waiter = deferred<T>();
      waiting.set(id, waiter);
      queue.push(id);
      if (!scheduled) {
        scheduled = true;
        if (delayMs === 0) queueMicrotask(flush);
        else options.env.setTimeout(flush, delayMs);
      }
      return waiter.promise;
    },
  };
}
