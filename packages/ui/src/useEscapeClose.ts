import { onCleanup, onMount } from "solid-js";

export function useEscapeClose(onClose: () => void) {
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });
}
