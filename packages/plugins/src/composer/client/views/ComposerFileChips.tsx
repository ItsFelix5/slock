import type { SlackFile } from "@slock/types";
import { For, Show } from "solid-js";
import type { createPendingFileState } from "../lib/pendingFiles";
import FileChip from "./FileChip";

export default function ComposerFileChips(props: {
  disabled: boolean;
  existingFiles: SlackFile[];
  onRemoveExisting: (id: string) => void;
  pendingFiles: ReturnType<typeof createPendingFileState>;
}) {
  return (
    <Show when={props.existingFiles.length > 0 || props.pendingFiles.files().length > 0}>
      <div class="composer-file-chips">
        <For each={props.existingFiles}>
          {(file) => (
            <FileChip
              disabled={props.disabled}
              file={new File([], file.title || file.name, { type: file.isImage ? "image/*" : "" })}
              onRemove={() => props.onRemoveExisting(file.id)}
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
      </div>
    </Show>
  );
}
