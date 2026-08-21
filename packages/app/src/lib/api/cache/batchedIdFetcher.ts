type PendingRequest<T> = {
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

export function createBatchedIdFetcher<T>(
  loadBatch: (ids: string[]) => Promise<ReadonlyMap<string, T>>,
  maxBatchSize: number,
): (id: string) => Promise<T> {
  const pending = new Map<string, PendingRequest<T>[]>();
  let scheduled = false;

  async function flush(): Promise<void> {
    scheduled = false;
    const requests = new Map(pending);
    pending.clear();
    const ids = [...requests.keys()];

    for (let start = 0; start < ids.length; start += maxBatchSize) {
      const batchIds = ids.slice(start, start + maxBatchSize);
      try {
        const values = await loadBatch(batchIds);
        for (const id of batchIds) {
          for (const request of requests.get(id) ?? []) request.resolve(values.get(id) as T);
        }
      } catch (error) {
        for (const id of batchIds) {
          for (const request of requests.get(id) ?? []) request.reject(error);
        }
      }
    }
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
