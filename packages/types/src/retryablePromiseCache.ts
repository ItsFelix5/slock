export function getOrCreateRetryablePromise<K, V>(
  cache: Map<K, Promise<V>>,
  key: K,
  load: () => Promise<V>,
): Promise<V> {
  const existing = cache.get(key);
  if (existing) return existing;

  const request = load().catch((error) => {
    if (cache.get(key) === request) cache.delete(key);
    throw error;
  });
  cache.set(key, request);
  return request;
}
