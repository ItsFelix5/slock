import { onSettled } from "solid-js";

type ClickOutsideTarget = string | (() => Element | null | undefined);

function isOutside(target: ClickOutsideTarget, e: MouseEvent): boolean {
  if (typeof target === "string") return !(e.target instanceof Element && e.target.closest(target));
  const el = target();
  return !!el && !(e.target instanceof Node && el.contains(e.target));
}

export function useClickOutside(
  target: ClickOutsideTarget | ClickOutsideTarget[],
  onClose: () => void,
) {
  onSettled(() => {
    const targets = Array.isArray(target) ? target : [target];
    const handler = (e: MouseEvent) => {
      if (targets.every((t) => isOutside(t, e))) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  });
}
