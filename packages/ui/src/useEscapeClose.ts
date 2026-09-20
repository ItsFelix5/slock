import { type Accessor, getOwner, type Owner, onCleanup, onMount, runWithOwner } from "solid-js";

interface EscapeLayer {
  enabled: Accessor<boolean>;
  onClose: () => void;
  owner: Owner | null;
}

const layers: EscapeLayer[] = [];

export function blurOnEnter(event: KeyboardEvent & { currentTarget: HTMLElement }): void {
  if (event.key === "Enter") event.currentTarget.blur();
}

export function closeAfterBlur(onClose: () => void, activeElement: { blur: () => void } | null) {
  activeElement?.blur();
  onClose();
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (!runWithOwner(layer.owner, layer.enabled)) continue;
    event.preventDefault();
    runWithOwner(layer.owner, () =>
      closeAfterBlur(
        layer.onClose,
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      ),
    );
    return;
  }
}

export function useEscapeClose(onClose: () => void, enabled: Accessor<boolean> = () => true) {
  const owner = getOwner();
  onMount(() => {
    const layer = { enabled, onClose, owner };
    if (layers.length === 0) document.addEventListener("keydown", handleEscape);
    layers.push(layer);
    onCleanup(() => {
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (layers.length === 0) document.removeEventListener("keydown", handleEscape);
    });
  });
}
