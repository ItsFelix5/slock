import type { PendingFile } from "@slock/types";
import { Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { formatSize } from "./FileCardInfo";
import "./MessageFiles.css";

export default function PendingFiles(props: { files: PendingFile[] }) {
  return (
    <div class="message-files flex-col">
      <For each={props.files}>
        {(file) => (
          <div class="message-file-card pending-file-card flex-align-center">
            <Show fallback={<Icon name="file" size={20} />} when={file.isImage && file.previewUrl}>
              {(src) => <img alt="" class="pending-file-thumb" src={src()} />}
            </Show>
            <span class="message-file-info flex-col">
              <span class="message-file-name truncate">{file.name}</span>
              <span class="message-file-meta meta-dim">{formatSize(file.size)}</span>
            </span>
            <div
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(file.progress * 100)}
              class="pending-file-progress"
              role="progressbar"
            >
              <div
                class="pending-file-progress-bar"
                style={{ width: `${Math.round(file.progress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
