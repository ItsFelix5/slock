import { type Deferred, deferred } from "./deferred";

export class BatchMissingId extends Error {
  constructor(id: string) {
    super(`batch result has no entry for ${id}`);
    this.name = "BatchMissingId";
  }
}

interface BatchLoaderOptions<T, K extends string> {
  load: (ids: K[]) => Promise<ReadonlyMap<K, T>>;
  maxBatch: number;
}

export function createBatchLoader<T, K extends string = string>({
  load,
  maxBatch,
}: BatchLoaderOptions<T, K>): (id: K) => Promise<T> {
  let queue = new Map<K, Deferred<T>>();

  async function runBatch(batch: Map<K, Deferred<T>>) {
    try {
      for (const [id, value] of await load([...batch.keys()])) {
        batch.get(id)?.resolve(value);
        batch.delete(id);
      }
      for (const [id, waiter] of batch) waiter.reject(new BatchMissingId(id));
    } catch (error) {
      for (const waiter of batch.values()) waiter.reject(error);
    }
  }

  function flush() {
    const waiting = [...queue];
    queue = new Map();
    for (let start = 0; start < waiting.length; start += maxBatch)
      void runBatch(new Map(waiting.slice(start, start + maxBatch)));
  }

  return (id) => {
    const queued = queue.get(id);
    if (queued) return queued.promise;
    const waiter = deferred<T>();
    if (queue.size === 0) queueMicrotask(flush);
    queue.set(id, waiter);
    return waiter.promise;
  };
}
