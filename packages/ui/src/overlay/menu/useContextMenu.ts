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

// The standard cross-platform keyboard equivalent for a right-click: the
// Menu key (rare on modern keyboards) and Shift+F10 (the one every OS still
// honors). Anchors the menu under the row that has focus rather than a
// cursor position, so it works the moment a row is focused — no Tab-hunting
// for a hidden trigger button required.
export function openContextMenuFromKeyboard(
  e: KeyboardEvent & { currentTarget: HTMLElement },
  openAt: (p: ContextMenuPoint) => void,
) {
  if (e.key !== "ContextMenu" && !(e.key === "F10" && e.shiftKey)) return;
  e.preventDefault();
  const rect = e.currentTarget.getBoundingClientRect();
  openAt({ x: rect.left + 12, y: rect.bottom });
}
