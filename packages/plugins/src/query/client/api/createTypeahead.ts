import { useDebouncer } from "@slock/core/solid";
import { isWaiting } from "@slock/resource";
import { createMemo, createSignal } from "solid-js";
import type { Query } from "./defineQuery";

interface TypeaheadOptions<Arg, T> {
  arg: (term: string) => Arg;
  delay: number;
  empty: T;
}

export interface Typeahead<T> {
  failed(): boolean;
  retry(): void;
  searching(): boolean;
  set(raw: string): void;
  value(): T;
}

export function createTypeahead<Arg, T>(
  query: Query<Arg, T>,
  { arg, delay, empty }: TypeaheadOptions<Arg, T>,
): Typeahead<T> {
  const [typed, setTyped] = createSignal("");
  const [term, setTerm] = createSignal("");
  const commit = useDebouncer(setTerm, delay);
  const state = query.state(() => (term() ? arg(term()) : undefined));
  const value = createMemo<T>((previous) => {
    if (!term()) return empty;
    const current = state();
    return isWaiting(current) ? (previous ?? empty) : (current.data ?? empty);
  });
  return {
    failed: () => typed() === term() && state().status === "error",
    retry() {
      if (term()) void query.refresh(arg(term())).catch(() => {});
    },
    searching: () => typed() !== term() || (!!term() && isWaiting(state())),
    set(raw) {
      const next = raw.trim();
      setTyped(next);
      if (next) return commit.schedule(next);
      commit.cancel();
      setTerm("");
    },
    value,
  };
}
