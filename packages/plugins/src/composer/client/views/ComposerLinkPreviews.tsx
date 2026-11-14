import { For, Show } from "solid-js";
import AttachmentCard from "../../../message-media/client/api/attachmentCard";
import RemovableAttachment from "../../../message-media/client/api/RemovableAttachment";
import type { LinkPreview } from "../lib/linkPreviews";

export default function ComposerLinkPreviews(props: {
  onRemove: (url: string) => void;
  previews: LinkPreview[];
}) {
  return (
    <Show when={props.previews.length}>
      <div class="composer-link-previews">
        <For each={props.previews}>
          {(preview) => (
            <RemovableAttachment alwaysShowRemove onRemove={() => props.onRemove(preview.url)}>
              <AttachmentCard attachment={preview.attachment} showPermalink />
            </RemovableAttachment>
          )}
        </For>
      </div>
    </Show>
  );
}
