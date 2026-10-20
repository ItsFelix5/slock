import type { ModalView } from "@slock/types";
import { createSignal } from "solid-js";

const TOAST_MS = 4000;

export function createModalsSlice() {
  const [viewStack, setViewStack] = createSignal<ModalView[]>([]);
  const [toast, setToast] = createSignal<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const topView = () => viewStack().at(-1) ?? null;

  function openView(view: ModalView) {
    setViewStack((stack) => {
      const top = stack.at(-1);
      return view.previous_view_id && view.previous_view_id === top?.id ? [...stack, view] : [view];
    });
  }

  function popView() {
    setViewStack((stack) => stack.slice(0, -1));
  }

  function updateView(view: ModalView) {
    setViewStack((stack) => stack.map((existing) => (existing.id === view.id ? view : existing)));
  }

  function closeAllViews() {
    setViewStack([]);
  }

  function showToast(text: string) {
    clearTimeout(toastTimer);
    setToast(text);
    toastTimer = setTimeout(() => setToast(null), TOAST_MS);
  }

  function dispose() {
    clearTimeout(toastTimer);
  }

  return {
    closeAllViews,
    dispose,
    openView,
    popView,
    showToast,
    toast,
    topView,
    updateView,
    viewStack,
  };
}
