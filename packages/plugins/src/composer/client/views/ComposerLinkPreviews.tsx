import AttachmentCard from "@slock/plugins/message-media/client/api/attachmentCard";
import RemovableAttachment from "@slock/plugins/message-media/client/api/RemovableAttachment";
import { For, Show } from "solid-js";
import type { LinkPreview } from "../lib/linkPreviews";

export default function ComposerLinkPreviews(props: {
  onRemove: (preview: LinkPreview) => void;
  previews: LinkPreview[];
}) {
  return (
    <Show when={props.previews.length}>
      <div class="composer-link-previews">
        <For each={props.previews}>
          {(preview) => (
            <RemovableAttachment onRemove={() => props.onRemove(preview)}>
              <AttachmentCard attachment={preview.attachment} showPermalink />
            </RemovableAttachment>
          )}
        </For>
      </div>
    </Show>
  );
}
