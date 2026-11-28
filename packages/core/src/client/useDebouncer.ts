import { onCleanup } from "solid-js";
import { service } from "../services";
import { createDebouncer, type Debouncer } from "../util/debouncer";

const env = service("env");

export function useDebouncer<A extends unknown[]>(
  run: (...args: A) => void,
  ms: number,
): Debouncer<A> {
  const debouncer = createDebouncer(env, run, ms);
  onCleanup(debouncer.cancel);
  return debouncer;
}
