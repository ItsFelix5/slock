import { service } from "@slock/core/solid";
import { createEffect, createSignal } from "solid-js";

const env = service("env");

export function createOptionSearch<T>(options: {
  active: () => boolean;
  delay: number;
  query: () => string;
  search: (query: string) => T[] | Promise<T[]>;
}): () => T[] {
  const [results, setResults] = createSignal<T[]>([]);

  createEffect(
    () => (options.active() ? options.query() : undefined),
    (text) => {
      if (text === undefined) return;
      let stale = false;
      const run = () =>
        Promise.resolve(options.search(text)).then(
          (found) => !stale && setResults(found),
          () => !stale && setResults([]),
        );
      const timer = text ? env.setTimeout(run, options.delay) : void run();
      return () => {
        stale = true;
        env.clearTimeout(timer);
      };
    },
  );

  return results;
}
