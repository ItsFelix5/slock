import { resolveMediaUrl, type SlackFile } from "@slock/types";
import { ConstrainedImage, constrainMediaDimensions, MediaFrame, VideoPlayer } from "@slock/ui";
import { createSignal, For, Match, Show, Switch } from "solid-js";
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

const GALLERY_MAX_WIDTH = 360;
const GALLERY_TILE_GAP = 6;
const GALLERY_TILE_SIZE = (GALLERY_MAX_WIDTH - GALLERY_TILE_GAP) / 2;

function mediaTileSize(file: SlackFile, mediaCount: number) {
  if (mediaCount > 1) return { height: GALLERY_TILE_SIZE, width: GALLERY_TILE_SIZE };
  return constrainMediaDimensions(
    file.width,
    file.height,
    GALLERY_MAX_WIDTH,
    320,
    GALLERY_MAX_WIDTH,
    180,
  );
}

function InlineMedia(props: {
  file: SlackFile;
  files: SlackFile[];
  gallery: { alt: string; src: string }[];
  mediaCount: number;
}) {
  const { file } = props;
  const dimensions = () => mediaTileSize(file, props.mediaCount);
  return (
    <Switch>
      <Match when={file.isImage ? file.thumbUrl : undefined}>
        {(thumb) => (
          <ConstrainedImage
            alt={file.title || file.name}
            blurSrc={file.thumbTiny ? `data:image/jpeg;base64,${file.thumbTiny}` : undefined}
            class="message-file-image"
            crop={props.mediaCount > 1}
            fullSrc={resolveMediaUrl(file.urlPrivate)}
            gallery={props.gallery}
            galleryIndex={imageGalleryIndex(props.files, file)}
            height={dimensions().height}
            src={thumb()}
            width={dimensions().width}
          />
        )}
      </Match>
      <Match when={file.isVideo}>
        <VideoFile dimensions={dimensions()} file={file} />
      </Match>
    </Switch>
  );
}

function VideoFile(props: { file: SlackFile; dimensions: { width: number; height: number } }) {
  const [video, setVideo] = createSignal<HTMLVideoElement>();
  const { file } = props;
  return (
    <VideoPlayer
      ariaLabel={file.title || file.name}
      captionsSrc={file.vtt}
      class="message-file-video"
      downloadHref={file.urlPrivateDownload}
      downloadName={file.name}
      duration={file.duration}
      height={props.dimensions.height}
      openHref={file.urlPrivate}
      poster={file.thumbUrl}
      ref={setVideo}
      src={resolveMediaUrl(file.urlPrivate)}
      toolbarExtra={
        <Show when={file.transcriptionPreview}>
          <TranscriptPopover file={file} media={video} triggerClass="video-player-chrome" />
        </Show>
      }
      width={props.dimensions.width}
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
          <FileCardInfo file={file} icon="file" linkUrl={file.permalink} />
        </a>
      }
    >
      <Match when={file.isDeleted}>
        <div class="message-file-card message-file-card-deleted flex-align-center">
          <FileCardInfo file={file} icon="file" />
        </div>
      </Match>
      <Match when={file.isAudio}>
        <AudioFile file={file} />
      </Match>
      <Match when={file.isPdf}>
        <FileViewerTrigger file={file} kind="pdf">
          <FileCardInfo file={file} icon="pdf-file" linkUrl={file.permalink} />
        </FileViewerTrigger>
      </Match>
      <Match when={file.isMail}>
        <FileViewerTrigger file={file} kind="mail">
          <FileCardInfo file={file} icon="email" linkUrl={file.permalink} />
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
  const mediaTitleUrl = () => (mediaFiles().length === 1 ? mediaFiles()[0].permalink : undefined);

  return (
    <div class="message-files flex-col">
      <Show when={mediaFiles().length}>
        <MediaFrame title={mediaTitle()} titleUrl={mediaTitleUrl()}>
          <div class="message-file-gallery" classList={{ single: mediaFiles().length === 1 }}>
            <For each={mediaFiles()}>
              {(file) => (
                <InlineMedia
                  file={file}
                  files={props.files}
                  gallery={gallery()}
                  mediaCount={mediaFiles().length}
                />
              )}
            </For>
          </div>
        </MediaFrame>
      </Show>
      <For each={otherFiles()}>{(file) => <OtherFile file={file} />}</For>
    </div>
  );
}
