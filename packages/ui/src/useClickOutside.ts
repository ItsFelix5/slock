import { onCleanup, onMount } from "solid-js";

export type ClickOutsideTarget = string | (() => Element | null | undefined);

function isOutside(target: ClickOutsideTarget, e: MouseEvent): boolean {
  if (typeof target === "string") return !(e.target as HTMLElement).closest?.(target);
  const el = target();
  return !!el && !el.contains(e.target as Node);
}

// Accepts either a CSS selector (kept for compatibility with existing call sites) or a
// ref-accessor function — the latter is needed when multiple instances of the same
// component (e.g. several per-item menus, or two simultaneous comboboxes) are mounted at
// once and must not cross-trigger each other's close handler.
export function useClickOutside(target: ClickOutsideTarget, onClose: () => void) {
  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (isOutside(target, e)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    onCleanup(() => document.removeEventListener("mousedown", handler, true));
  });
}
