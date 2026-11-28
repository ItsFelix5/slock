import { createSignal } from "solid-js";
import type { MemeTarget } from "./api";

export function createMemeStore() {
  const [target, setTarget] = createSignal<MemeTarget>();
  return {
    close: () => setTarget(undefined),
    open: (next: MemeTarget) => setTarget(next),
    target,
  };
}
