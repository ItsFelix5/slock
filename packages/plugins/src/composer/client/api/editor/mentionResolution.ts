import { service } from "@slock/core/solid";
import type Quill from "@slock/ui/editor/quill";
import { createEffect, createSignal } from "solid-js";
import type { MentionValue } from "../../lib/embedValues";
import { mentionLabel } from "../../lib/quillMentions";

const usersStore = service("users");
const channelsStore = service("channels");

type ResolvableKind = Extract<MentionValue["kind"], "channel" | "user">;

interface Pending {
  id: string;
  kind: ResolvableKind;
}

function knownName({ id, kind }: Pending): string | undefined {
  return kind === "user" ? usersStore.userById(id)?.name : channelsStore.channelById(id)?.name;
}

export function useMentionResolution(
  getQuill: () => Quill | undefined,
): (id: string, kind?: ResolvableKind) => void {
  const [pending, setPending] = createSignal<Pending[]>([]);

  createEffect(() => {
    for (const item of pending()) {
      const name = knownName(item);
      if (!name) continue;
      getQuill()
        ?.root.querySelectorAll<HTMLElement>(
          `.bk-mention[data-kind="${item.kind}"][data-id="${item.id}"]`,
        )
        .forEach((node) => {
          if (node.dataset.name !== item.id) return;
          node.dataset.name = name;
          node
            .querySelector('[contenteditable="false"]')
            ?.replaceChildren(...mentionLabel({ ...item, name }));
        });
      setPending((items) => items.filter((other) => other !== item));
    }
  });

  return (id, kind = "user") =>
    setPending((items) =>
      items.some((item) => item.id === id && item.kind === kind) ? items : [...items, { id, kind }],
    );
}
