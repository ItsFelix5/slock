import { type Accessor, onCleanup, onMount } from "solid-js";

interface EscapeLayer {
  enabled: Accessor<boolean>;
  onClose: () => void;
}

const layers: EscapeLayer[] = [];

export function closeAfterBlur(onClose: () => void, activeElement: { blur: () => void } | null) {
  activeElement?.blur();
  onClose();
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (!layer.enabled()) continue;
    event.preventDefault();
    closeAfterBlur(
      layer.onClose,
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    return;
  }
}

export function useEscapeClose(onClose: () => void, enabled: Accessor<boolean> = () => true) {
  onMount(() => {
    const layer = { enabled, onClose };
    if (layers.length === 0) document.addEventListener("keydown", handleEscape);
    layers.push(layer);
    onCleanup(() => {
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (layers.length === 0) document.removeEventListener("keydown", handleEscape);
    });
  });
}
