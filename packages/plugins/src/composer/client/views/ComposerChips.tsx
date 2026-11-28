import type { SlackFile } from "@slock/types";
import { For, Show } from "solid-js";
import type { LinkPreview } from "../lib/linkPreviews";
import type { createPendingFileState } from "../lib/pendingFiles";
import FileChip from "./FileChip";
import LinkPreviewChip from "./LinkPreviewChip";

export default function ComposerChips(props: {
  disabled: boolean;
  existingFiles: SlackFile[];
  onRemoveExisting: (id: string) => void;
  onRemovePreview: (preview: LinkPreview) => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
  previews: LinkPreview[];
}) {
  return (
    <Show
      when={
        props.existingFiles.length > 0 ||
        props.pendingFiles.files().length > 0 ||
        props.previews.length > 0
      }
    >
      <div class="composer-file-chips">
        <For each={props.existingFiles}>
          {(file) => (
            <FileChip
              disabled={props.disabled}
              file={new File([], file.title || file.name, { type: file.isImage ? "image/*" : "" })}
              onRemove={() => props.onRemoveExisting(file.id)}
              fullSrc={file.urlPrivate}
              thumbSrc={file.thumbUrl}
            />
          )}
        </For>
        <For each={props.pendingFiles.files()}>
          {(file, index) => (
            <FileChip
              disabled={props.disabled}
              file={file}
              onRemove={() => props.pendingFiles.remove(index())}
              onRename={(name) => props.pendingFiles.rename(index(), name)}
            />
          )}
        </For>
        <For each={props.previews}>
          {(preview) => (
            <LinkPreviewChip
              attachment={preview.attachment}
              onRemove={() => props.onRemovePreview(preview)}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
