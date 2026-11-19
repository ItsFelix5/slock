import type { Attachment } from "@slock/types";
import { createMemo, createSignal } from "solid-js";
import type { LinkPreview } from "./linkPreviews";

export function createEditAttachments(initial: () => Attachment[] | undefined) {
  const [removed, setRemoved] = createSignal<number[]>([]);
  const previews = createMemo<LinkPreview[]>(() =>
    (initial() ?? []).flatMap((attachment) =>
      attachment.id === undefined || removed().includes(attachment.id)
        ? []
        : [{ attachment, url: attachment.fromUrl ?? "" }],
    ),
  );
  return {
    previews,
    removed,
    remove({ attachment }: LinkPreview) {
      const { id } = attachment;
      if (id !== undefined) setRemoved((ids) => [...ids, id]);
    },
  };
}
