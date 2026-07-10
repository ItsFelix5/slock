import type { SlackFile } from "@slock/slack-api";
import { fileProxyUrl } from "@slock/slack-api";
import { Icon, ZoomableImage } from "@slock/ui";
import { For, Show } from "solid-js";
import "./MessageFiles.css";

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageFiles(props: { files: SlackFile[] }) {
  return (
    <div class="message-files">
      <For each={props.files}>
        {(file) => (
          <Show
            when={file.isImage && file.thumbUrl}
            fallback={
              <a
                class="message-file-card"
                href={fileProxyUrl(file.urlPrivate)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="code-block" size={20} />
                <span class="message-file-info">
                  <span class="message-file-name">{file.title || file.name}</span>
                  <span class="message-file-meta">
                    {file.filetype?.toUpperCase()} {formatSize(file.size)}
                  </span>
                </span>
              </a>
            }
          >
            {(thumb) => (
              <ZoomableImage
                class="message-file-image"
                src={fileProxyUrl(thumb())}
                fullSrc={fileProxyUrl(file.urlPrivate)}
                alt={file.title || file.name}
                width={file.width}
                height={file.height}
              />
            )}
          </Show>
        )}
      </For>
    </div>
  );
}
