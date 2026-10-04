import type Quill from "quill";
import { createEffect, createSignal } from "solid-js";
import { store } from "../../../lib/store";

export function useMentionResolution(getQuill: () => Quill | undefined): (id: string) => void {
  const [pendingIds, setPendingIds] = createSignal<string[]>([]);

  createEffect(() => {
    for (const id of pendingIds()) {
      const user = store.users.userById(id);
      if (!user) continue;
      getQuill()
        ?.root.querySelectorAll<HTMLElement>(`.bk-mention[data-kind="user"][data-id="${id}"]`)
        .forEach((node) => {
          if (node.dataset.name !== id) return;
          node.dataset.name = user.name;
          const label = node.querySelector('[contenteditable="false"]');
          if (label) label.textContent = `@${user.name}`;
        });
      setPendingIds((ids) => ids.filter((pendingId) => pendingId !== id));
    }
  });

  return (id: string) => setPendingIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
}
