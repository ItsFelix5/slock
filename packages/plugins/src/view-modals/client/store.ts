import { createDebouncer } from "@slock/core";
import { service } from "@slock/core/solid";
import type { ModalView } from "@slock/types";
import { createSignal } from "solid-js";

const TOAST_MS = 4000;
const env = service("env");

export function createModalsSlice() {
  const [viewStack, setViewStack] = createSignal<ModalView[]>([]);
  const [toast, setToast] = createSignal<string | null>(null);
  const hideToast = createDebouncer(env, () => setToast(null), TOAST_MS);

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
    setToast(text);
    hideToast.schedule();
  }

  return {
    closeAllViews,
    dispose: hideToast.cancel,
    openView,
    popView,
    showToast,
    toast,
    topView,
    updateView,
    viewStack,
  };
}
