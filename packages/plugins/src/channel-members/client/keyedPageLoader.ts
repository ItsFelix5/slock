import { createStore } from "solid-js";

type LoadStatus = "loading" | "loaded" | "error";

export function createKeyedPageLoader<Key extends string, Page>(options: {
  load: (key: Key) => Promise<Page>;
  onResult: (key: Key, page: Page) => void;
}) {
  const [status, setStatus] = createStore<Record<string, LoadStatus | undefined>>({});
  const inflight = new Set<Key>();
  const mark = (key: Key, next: LoadStatus) =>
    setStatus((draft) => {
      draft[key] = next;
    });

  async function load(key: Key): Promise<boolean> {
    if (inflight.has(key)) return false;
    inflight.add(key);
    mark(key, "loading");
    try {
      const page = await options.load(key);
      options.onResult(key, page);
      mark(key, "loaded");
      return true;
    } catch {
      mark(key, "error");
      return false;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    hasError: (key: Key) => status[key] === "error",
    hasLoaded: (key: Key) => status[key] === "loaded",
    isLoading: (key: Key) => status[key] === "loading",
    load,
  };
}
