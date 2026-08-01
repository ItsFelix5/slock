import { Mrkdwn } from "@slock/blockkit";
import { resolveMediaUrl, type SlackFile } from "@slock/slack-api";
import { Icon, type IconName, VideoPlayer, ZoomableImage } from "@slock/ui";
import { For, Match, Show, Switch } from "solid-js";
import { store } from "../../../../lib/store";
import AudioFile from "./AudioFile";
import { constrainMediaDimensions } from "./estimateMediaHeight";
import FileViewerTrigger from "./FileViewer";
import "./MessageFiles.css";

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileCardInfo(props: { file: SlackFile; icon: IconName; mrkdwnTitle?: boolean }) {
  const name = () => props.file.title || props.file.name;
  return (
    <>
      <Icon name={props.icon} size={20} />
      <span class="message-file-info">
        <span class="message-file-name">
          <Show fallback={name()} when={props.mrkdwnTitle}>
            <Mrkdwn text={name()} />
          </Show>
        </span>
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
              {(thumb) => {
                const dimensions = () =>
                  constrainMediaDimensions(file.width, file.height, 360, 320, 360, 180);
                return (
                  <ZoomableImage
                    alt={file.title || file.name}
                    blurSrc={
                      file.thumbTiny ? `data:image/jpeg;base64,${file.thumbTiny}` : undefined
                    }
                    class="message-file-image"
                    fullSrc={resolveMediaUrl(file.urlPrivate)}
                    height={dimensions().height}
                    reservedHeight={dimensions().height}
                    reservedWidth={dimensions().width}
                    src={thumb()}
                    width={dimensions().width}
                  />
                );
              }}
            </Match>
            <Match when={file.isVideo}>
              <VideoPlayer
                ariaLabel={file.title || file.name}
                class="message-file-video"
                height={file.height}
                openHref={file.urlPrivate}
                poster={file.thumbUrl}
                src={resolveMediaUrl(file.urlPrivate)}
                width={file.width}
              />
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
                <FileCardInfo file={file} icon="open-in-canvas" mrkdwnTitle />
              </button>
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}
