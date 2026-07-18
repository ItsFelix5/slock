import type { ModalView } from "@slock/slack-api";
import { createMemo, createSignal } from "solid-js";

// Apps open modals as a stack: a shortcut/action opens the root view, and the
// app can then `views.push` further views on top (each carrying
// `previous_view_id`). The gateway only tells us about pushes via a fresh
// `view_opened` event, so that's the one signal we use to decide push vs.
// replace.
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
