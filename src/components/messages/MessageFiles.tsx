import { For, Show } from 'solid-js';
import type { SlackFile } from '../../lib/types';
import { fileProxyUrl } from '../../lib/slackApi';
import Icon from '../../icons';
import './MessageFiles.css';

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
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
                <Icon name="codeBlock" size={20} />
                <span class="message-file-info">
                  <span class="message-file-name">{file.title || file.name}</span>
                  <span class="message-file-meta">{file.filetype?.toUpperCase()} {formatSize(file.size)}</span>
                </span>
              </a>
            }
          >
            {(thumb) => (
              <a href={fileProxyUrl(file.urlPrivate)} target="_blank" rel="noopener noreferrer" class="message-file-image-link">
                <img
                  class="message-file-image"
                  src={fileProxyUrl(thumb())}
                  alt={file.title || file.name}
                  width={file.width}
                  height={file.height}
                />
              </a>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}
