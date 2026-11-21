import { service } from "@slock/core/solid";
import type { TimerHandle } from "@slock/core/types";
import {
  affects,
  createMemo,
  createSignal,
  isPending,
  onCleanup,
  refresh,
  untrack,
} from "solid-js";

const env = service("env");

type Settled<T> = { ok: true; value: T } | { ok: false };

function settle<T>(request: Promise<T>): Promise<Settled<T>> {
  return request.then(
    (value) => ({ ok: true, value }),
    () => ({ ok: false }),
  );
}

function createDebouncedQuery(delay: number) {
  const [input, setInput] = createSignal("");
  const [value, setValue] = createSignal("");
  let timer: TimerHandle | undefined;

  const commit = (query: string) => {
    env.clearTimeout(timer);
    timer = undefined;
    setValue(query);
  };

  onCleanup(() => env.clearTimeout(timer));

  return {
    input,
    pending: createMemo(() => input() !== value()),
    set(raw: string, immediate = false) {
      const query = raw.trim();
      setInput(query);
      env.clearTimeout(timer);
      if (immediate || !query) commit(query);
      else timer = env.setTimeout(() => commit(query), delay);
    },
    value,
  };
}

export function createDebouncedSearch<T>(options: {
  delay: number;
  empty: T;
  search: (query: string) => Promise<T>;
}) {
  const query = createDebouncedQuery(options.delay);
  const idle: Settled<T> = { ok: true, value: options.empty };
  const outcome = createMemo(() => {
    const text = query.value();
    return text ? settle(untrack(() => options.search(text))) : idle;
  });
  return {
    failed: () => !outcome().ok,
    refresh() {
      affects(outcome);
      refresh(outcome);
    },
    searching: () => query.pending() || isPending(outcome),
    set: query.set,
    value: (): T => {
      const settled = outcome();
      return settled.ok ? settled.value : options.empty;
    },
  };
}
