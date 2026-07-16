import { onCleanup, onMount } from "solid-js";

export type ClickOutsideTarget = string | (() => Element | null | undefined);

function isOutside(target: ClickOutsideTarget, e: MouseEvent): boolean {
  if (typeof target === "string") return !(e.target as HTMLElement).closest?.(target);
  const el = target();
  return !!el && !el.contains(e.target as Node);
}

// Accepts either a single target or a list of targets (kept for compatibility with
// existing call sites). A list is needed once a panel is Portal-rendered elsewhere in the
// DOM (e.g. via FloatingPanel) — the click then has to be outside the trigger *and* the
// portaled panel to count as "outside".
export function useClickOutside(
  target: ClickOutsideTarget | ClickOutsideTarget[],
  onClose: () => void,
) {
  onMount(() => {
    const targets = Array.isArray(target) ? target : [target];
    const handler = (e: MouseEvent) => {
      if (targets.every((t) => isOutside(t, e))) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    onCleanup(() => document.removeEventListener("mousedown", handler, true));
  });
}
