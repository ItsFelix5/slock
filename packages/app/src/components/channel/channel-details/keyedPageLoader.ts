import { createStore } from "solid-js/store";

type LoadStatus = "loading" | "loaded" | "error";

export function createKeyedPageLoader<Key extends string, Page>(options: {
  load: (key: Key) => Promise<Page>;
  onResult: (key: Key, page: Page) => void;
}) {
  const [status, setStatus] = createStore<Record<string, LoadStatus | undefined>>({});

  async function load(key: Key): Promise<boolean> {
    if (status[key] === "loading") return false;
    setStatus(key, "loading");
    try {
      const page = await options.load(key);
      options.onResult(key, page);
      setStatus(key, "loaded");
      return true;
    } catch {
      setStatus(key, "error");
      return false;
    }
  }

  return {
    hasError: (key: Key) => status[key] === "error",
    hasLoaded: (key: Key) => status[key] === "loaded",
    isLoading: (key: Key) => status[key] === "loading",
    load,
  };
}
