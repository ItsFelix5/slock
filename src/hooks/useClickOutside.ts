import { onCleanup, onMount } from "solid-js";

export function useClickOutside(selector: string, onClose: () => void) {
  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(selector)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    onCleanup(() => document.removeEventListener("mousedown", handler, true));
  });
}
