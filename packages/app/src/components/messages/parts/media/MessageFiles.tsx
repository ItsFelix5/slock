import { ConstrainedImage, constrainMediaDimensions, MediaFrame, VideoPlayer } from "@slock/ui";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import { resolveMediaUrl, type SlackFile } from "../../../../lib/api";
import { fileSummaryLabel } from "../../../../lib/fileSummary";
import { store } from "../../../../lib/store";
import AudioFile from "./AudioFile";
import FileCardInfo from "./FileCardInfo";
import FileViewerTrigger from "./FileViewer";
import "./MessageFiles.css";
import TranscriptPopover from "./TranscriptPopover";

function isCanvasFile(file: SlackFile) {
  return file.filetype === "quip";
}

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
            constrainMediaDimensions(file.width, file.height, 360, 320, 360, 180);
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
  const dimensions = () => constrainMediaDimensions(file.width, file.height, 360, 320, 360, 180);
  return (
    <VideoPlayer
      ariaLabel={file.title || file.name}
      captionsSrc={file.vtt}
      class="message-file-video"
      downloadHref={file.urlPrivateDownload}
      downloadName={file.name}
      duration={file.duration}
      height={dimensions().height}
      openHref={file.urlPrivate}
      poster={file.thumbUrl}
      ref={setVideo}
      src={resolveMediaUrl(file.urlPrivate)}
      toolbarExtra={
        <Show when={file.transcriptionPreview}>
          <TranscriptPopover file={file} media={video} triggerClass="video-player-chrome" />
        </Show>
      }
      width={dimensions().width}
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
      <Match when={isCanvasFile(file)}>
        <button
          class="message-file-card flex-align-center btn-reset"
          onClick={() => store.canvas.openCanvasPane(file.id, file.title || file.name)}
          type="button"
        >
          <FileCardInfo file={file} icon="canvas" />
        </button>
      </Match>
    </Switch>
  );
}

export default function MessageFiles(props: { files: SlackFile[] }) {
  const mediaFiles = () => props.files.filter(isInlineMedia);
  const otherFiles = () => props.files.filter((file) => !isInlineMedia(file));
  const gallery = () => imageGallery(props.files);
  const mediaTitle = () => fileSummaryLabel(mediaFiles());

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
