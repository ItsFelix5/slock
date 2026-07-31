export function createKeyedPageLoader<Key, Page>(options: {
  load: (key: Key) => Promise<Page>;
  onResult: (key: Key, page: Page) => void;
  onStateChange?: () => void;
}) {
  const errors = new Set<Key>();
  const loaded = new Set<Key>();
  const loading = new Set<Key>();

  async function load(key: Key): Promise<boolean> {
    if (loading.has(key)) return false;
    loading.add(key);
    errors.delete(key);
    options.onStateChange?.();
    try {
      const page = await options.load(key);
      options.onResult(key, page);
      loaded.add(key);
      return true;
    } catch {
      loaded.delete(key);
      errors.add(key);
      return false;
    } finally {
      loading.delete(key);
      options.onStateChange?.();
    }
  }

  return {
    hasError: (key: Key) => errors.has(key),
    hasLoaded: (key: Key) => loaded.has(key),
    isLoading: (key: Key) => loading.has(key),
    load,
  };
}
