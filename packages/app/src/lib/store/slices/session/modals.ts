import type { ModalView } from "@slock/slack-api";
import { createMemo, createSignal } from "solid-js";

export function createModalsSlice() {
  const [viewStack, setViewStack] = createSignal<ModalView[]>([]);
  const topView = createMemo(() => viewStack().at(-1) ?? null);

  function openView(view: ModalView) {
    setViewStack((stack) => {
      const top = stack.at(-1);
      return view.previous_view_id && view.previous_view_id === top?.id ? [...stack, view] : [view];
    });
  }

  function popView() {
    setViewStack((stack) => stack.slice(0, -1));
  }

  function closeAllViews() {
    setViewStack([]);
  }

  return { closeAllViews, openView, popView, viewStack, topView };
}
