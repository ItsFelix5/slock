type PendingRequest<T> = {
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

export function createBatchedIdFetcher<T, K extends string = string>(
  loadBatch: (ids: K[]) => Promise<ReadonlyMap<K, T>>,
  maxBatchSize: number,
): (id: K) => Promise<T> {
  const pending = new Map<K, PendingRequest<T>[]>();
  let scheduled = false;

  async function flush(): Promise<void> {
    scheduled = false;
    const requests = new Map(pending);
    pending.clear();
    const ids = [...requests.keys()];
    const batches: K[][] = [];
    for (let start = 0; start < ids.length; start += maxBatchSize)
      batches.push(ids.slice(start, start + maxBatchSize));

    await Promise.all(
      batches.map(async (batchIds) => {
        try {
          const values = await loadBatch(batchIds);
          for (const [id, value] of values) {
            for (const request of requests.get(id) ?? []) request.resolve(value);
          }
        } catch (error) {
          for (const id of batchIds) {
            for (const request of requests.get(id) ?? []) request.reject(error);
          }
        }
      }),
    );
  }

  return (id) =>
    new Promise((resolve, reject) => {
      const requests = pending.get(id) ?? [];
      requests.push({ reject, resolve });
      pending.set(id, requests);
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => void flush());
    });
}
