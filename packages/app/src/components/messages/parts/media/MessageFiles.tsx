import { Mrkdwn } from "@slock/blockkit";
import { ConstrainedImage, Icon, type IconName, MediaFrame, VideoPlayer } from "@slock/ui";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { resolveMediaUrl, type SlackFile } from "../../../../lib/api";
import AudioFile from "./AudioFile";
import FileViewerTrigger from "./FileViewer";
import { constrainMediaDimensions } from "./mediaDimensions";
import "./MessageFiles.css";
import TranscriptPopover from "./TranscriptPopover";

function imageGallery(files: SlackFile[]) {
  return files
    .filter((file) => file.isImage && file.thumbUrl && file.urlPrivate)
    .map((file) => ({
      alt: file.title || file.name,
      src: resolveMediaUrl(file.urlPrivate),
    }));
}

function imageGalleryIndex(files: SlackFile[], file: SlackFile) {
  return files.filter((item) => item.isImage && item.thumbUrl && item.urlPrivate).indexOf(file);
}

export function formatSize(bytes: number | undefined): string {
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

function isInlineMedia(file: SlackFile) {
  return (file.isImage && file.thumbUrl) || file.isVideo;
}

function InlineMedia(props: {
  file: SlackFile;
  files: SlackFile[];
  gallery: { alt: string; src: string }[];
}) {
  const { file } = props;
  return (
    <Switch>
      <Match when={file.isImage ? file.thumbUrl : undefined}>
        {(thumb) => {
          const dimensions = () =>
            constrainMediaDimensions(file.width, file.height, 360, 320, 360, 180, true);
          return (
            <ConstrainedImage
              alt={file.title || file.name}
              blurSrc={file.thumbTiny ? `data:image/jpeg;base64,${file.thumbTiny}` : undefined}
              class="message-file-image"
              fullSrc={resolveMediaUrl(file.urlPrivate)}
              gallery={props.gallery}
              galleryIndex={imageGalleryIndex(props.files, file)}
              height={dimensions().height}
              src={thumb()}
              width={dimensions().width}
            />
          );
        }}
      </Match>
      <Match when={file.isVideo}>
        <VideoFile file={file} />
      </Match>
    </Switch>
  );
}

function VideoFile(props: { file: SlackFile }) {
  const [video, setVideo] = createSignal<HTMLVideoElement>();
  const { file } = props;
  return (
    <VideoPlayer
      ariaLabel={file.title || file.name}
      captionsSrc={file.vtt}
      class="message-file-video"
      duration={file.duration}
      height={file.height}
      openHref={file.urlPrivate}
      poster={file.thumbUrl}
      ref={setVideo}
      src={resolveMediaUrl(file.urlPrivate)}
      toolbarExtra={
        <Show when={file.transcriptionPreview}>
          <TranscriptPopover file={file} media={video} triggerClass="video-player-chrome" />
        </Show>
      }
      width={file.width}
    />
  );
}

function OtherFile(props: { file: SlackFile }) {
  const { file } = props;
  return (
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
    </Switch>
  );
}

export default function MessageFiles(props: { files: SlackFile[] }) {
  const mediaFiles = createMemo(() => props.files.filter(isInlineMedia));
  const otherFiles = createMemo(() => props.files.filter((file) => !isInlineMedia(file)));
  const gallery = () => imageGallery(props.files);
  const mediaTitle = () => {
    const files = mediaFiles();
    return files.length === 1 ? files[0].title || files[0].name : `${files.length} files`;
  };

  return (
    <div class="message-files">
      <Show when={mediaFiles().length}>
        <MediaFrame title={mediaTitle()}>
          <div class="message-file-gallery" classList={{ single: mediaFiles().length === 1 }}>
            <For each={mediaFiles()}>
              {(file) => <InlineMedia file={file} files={props.files} gallery={gallery()} />}
            </For>
          </div>
        </MediaFrame>
      </Show>
      <For each={otherFiles()}>{(file) => <OtherFile file={file} />}</For>
    </div>
  );
}
