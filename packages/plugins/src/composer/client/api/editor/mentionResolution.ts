import { service } from "@slock/core/solid";
import { isChannelId } from "@slock/slack";
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
  if (kind === "user") return usersStore.userById(id)?.name;
  return isChannelId(id) ? channelsStore.channelById(id)?.name : undefined;
}

export function useMentionResolution(
  getQuill: () => Quill | undefined,
): (id: string, kind?: ResolvableKind) => void {
  const [pending, setPending] = createSignal<Pending[]>([]);

  createEffect(
    () => pending().map((item) => ({ item, name: knownName(item) })),
    (entries) => {
      const resolved = entries.flatMap(({ item, name }) => (name ? [{ item, name }] : []));
      if (resolved.length === 0) return;
      for (const { item, name } of resolved) {
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
      }
      setPending((items) => items.filter((other) => !resolved.some(({ item }) => item === other)));
    },
  );

  return (id, kind = "user") =>
    setPending((items) =>
      items.some((item) => item.id === id && item.kind === kind) ? items : [...items, { id, kind }],
    );
}
