import { IconButton } from "@slock/ui";
import { For, Show } from "solid-js";
import AttachmentCard from "../../../message-media/client/api/attachmentCard";
import type { LinkPreview } from "../lib/linkPreviews";
import "./ComposerLinkPreviews.css";

export default function ComposerLinkPreviews(props: {
  onRemove: (url: string) => void;
  previews: LinkPreview[];
}) {
  return (
    <Show when={props.previews.length}>
      <div class="composer-link-previews">
        <For each={props.previews}>
          {(preview) => (
            <div class="composer-link-preview">
              <AttachmentCard attachment={preview.attachment} showPermalink />
              <IconButton
                class="composer-link-preview-remove icon-shift"
                icon="close"
                label="Remove link preview"
                onClick={() => props.onRemove(preview.url)}
                size="sm"
              />
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
