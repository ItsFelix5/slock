import { createSignal } from "solid-js";

type ContextMenuPoint = { x: number; y: number };

export function useContextMenu() {
  const [point, setPoint] = createSignal<ContextMenuPoint | null>(null);

  const open = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPoint({ x: e.clientX, y: e.clientY });
  };
  const openAt = (p: ContextMenuPoint) => setPoint(p);
  const close = () => setPoint(null);

  return {
    close,
    isOpen: () => point() !== null,
    open,
    openAt,
    x: () => point()?.x ?? 0,
    y: () => point()?.y ?? 0,
  };
}

export function openContextMenuFromKeyboard(
  e: KeyboardEvent & { currentTarget: HTMLElement },
  openAt: (p: ContextMenuPoint) => void,
) {
  if (e.key !== "ContextMenu" && !(e.key === "F10" && e.shiftKey)) return;
  e.preventDefault();
  const rect = e.currentTarget.getBoundingClientRect();
  openAt({ x: rect.left + 12, y: rect.bottom });
}
