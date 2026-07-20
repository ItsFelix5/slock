import { fileProxyUrl, type SlackFile } from "@slock/slack-api";
import { Icon, type IconName, ZoomableImage } from "@slock/ui";
import { For, Match, Switch } from "solid-js";
import { store } from "../../../../lib/store";
import AudioFile from "./AudioFile";
import FileViewerTrigger from "./FileViewer";
import "./MessageFiles.css";

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileCardInfo(props: { file: SlackFile; icon: IconName }) {
  return (
    <>
      <Icon name={props.icon} size={20} />
      <span class="message-file-info">
        <span class="message-file-name">{props.file.title || props.file.name}</span>
        <span class="message-file-meta">
          {props.file.filetype?.toUpperCase()} {formatSize(props.file.size)}
        </span>
      </span>
    </>
  );
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
                <FileCardInfo file={file} icon="file" />
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
            <Match when={file.isPdf}>
              <FileViewerTrigger file={file} kind="pdf">
                <FileCardInfo file={file} icon="pdf-file" />
              </FileViewerTrigger>
            </Match>
            <Match when={file.isMail}>
              <FileViewerTrigger file={file} kind="mail">
                <FileCardInfo file={file} icon="email" />
              </FileViewerTrigger>
            </Match>
            <Match when={file.isCanvas}>
              <button
                class="message-file-card flex-align-center btn-reset"
                onClick={() => store.canvas.openFileCanvas(file.id, file.title || file.name)}
                type="button"
              >
                <FileCardInfo file={file} icon="open-in-canvas" />
              </button>
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}
