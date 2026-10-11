import { service } from "@slock/core/solid";
import type Quill from "quill";
import { createEffect, createSignal } from "solid-js";

const usersStore = service("users");

export function useMentionResolution(getQuill: () => Quill | undefined): (id: string) => void {
  const [pendingIds, setPendingIds] = createSignal<string[]>([]);

  createEffect(() => {
    for (const id of pendingIds()) {
      const user = usersStore.userById(id);
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
