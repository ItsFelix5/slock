import { createSignal } from "solid-js";

type ContextMenuPoint = { x: number; y: number };

export function useContextMenu() {
  const [point, setPoint] = createSignal<ContextMenuPoint | null>(null);

  const open = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPoint({ x: e.clientX, y: e.clientY });
  };
  const close = () => setPoint(null);

  return {
    close,
    isOpen: () => point() !== null,
    open,
    x: () => point()?.x ?? 0,
    y: () => point()?.y ?? 0,
  };
}
