import { fileProxyUrl, type SlackFile } from "@slock/slack-api";
import { Icon, ZoomableImage } from "@slock/ui";
import { For, Match, Switch } from "solid-js";
import AudioFile from "./AudioFile";
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
          <Switch
            fallback={
              <a
                class="message-file-card flex-align-center"
                href={file.urlPrivate}
                rel="noopener noreferrer"
                target="_blank"
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
            <Match when={file.isImage ? file.thumbUrl : undefined}>
              {(thumb) => (
                <ZoomableImage
                  alt={file.title || file.name}
                  class="message-file-image"
                  fullSrc={fileProxyUrl(file.urlPrivate)}
                  height={file.height}
                  src={thumb()}
                  width={file.width}
                />
              )}
            </Match>
            <Match when={file.isVideo}>
              <video
                aria-label={file.title || file.name}
                class="message-file-video"
                controls
                height={file.height}
                poster={file.thumbUrl}
                preload="metadata"
                width={file.width}
              >
                <source src={fileProxyUrl(file.urlPrivate)} type={file.mimetype} />
                Your browser does not support the video tag.
              </video>
            </Match>
            <Match when={file.isAudio}>
              <AudioFile file={file} />
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}
