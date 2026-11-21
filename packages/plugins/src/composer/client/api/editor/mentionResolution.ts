import { service } from "@slock/core/solid";
import { isChannelId, isUserId } from "@slock/slack";
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
  if (kind === "user") return isUserId(id) ? usersStore.userById(id)?.name : undefined;
  return isChannelId(id) ? channelsStore.channelById(id)?.name : undefined;
}

export function useMentionResolution(
  getQuill: () => Quill | undefined,
): (id: string, kind?: ResolvableKind) => void {
  const [pending, setPending] = createSignal<Pending[]>([]);

  createEffect(
    () => ({
      entries: pending().map((item) => ({ item, name: knownName(item) })),
      quill: getQuill(),
    }),
    ({ entries, quill }) => {
      const resolved = entries.flatMap(({ item, name }) => (name ? [{ item, name }] : []));
      if (!quill || resolved.length === 0) return;
      for (const { item, name } of resolved) {
        quill.root
          .querySelectorAll<HTMLElement>(
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
