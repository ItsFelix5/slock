import { resolveMediaUrl, type SlackFile } from "@slock/types";
import {
  ConstrainedImage,
  constrainMediaDimensions,
  Icon,
  type IconName,
  VideoPlayer,
} from "@slock/ui";
import { createSignal, type JSX, Match, Show, Switch } from "solid-js";
import { store } from "../../../lib/store";
import AudioFile from "../../messages/parts/media/AudioFile";
import FileViewerTrigger from "../../messages/parts/media/FileViewer";
import TranscriptPopover from "../../messages/parts/media/TranscriptPopover";

function Frame(props: { children: JSX.Element }) {
  return <div class="file-detail-preview flex-center">{props.children}</div>;
}

function ActionLabel(props: { icon: IconName; label: string }) {
  return (
    <>
      <Icon name={props.icon} size={16} />
      <span>{props.label}</span>
    </>
  );
}

export default function FileDetailPreview(props: {
  content: string | null | undefined;
  failed: boolean;
  file: SlackFile;
  onClose: () => void;
}) {
  const [video, setVideo] = createSignal<HTMLVideoElement>();
  const name = () => props.file.title || props.file.name;
  const image = () =>
    constrainMediaDimensions(props.file.width, props.file.height, 560, 420, 480, 320);

  return (
    <Switch
      fallback={
        <Show
          fallback={
            <p class="text-dim">
              {props.file.isDeleted || props.failed ? "File is no longer available" : "Loading…"}
            </p>
          }
          when={!props.file.isDeleted && props.file.urlPrivate}
        >
          <a
            class="btn btn-secondary btn-md file-detail-action"
            href={props.file.urlPrivate}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ActionLabel icon="file" label="Open file" />
          </a>
        </Show>
      }
    >
      <Match when={props.file.filetype === "quip"}>
        <button
          class="btn btn-secondary btn-md file-detail-action"
          onClick={() => {
            props.onClose();
            store.canvas.openCanvasPane(props.file.id, name());
          }}
          type="button"
        >
          <ActionLabel icon="canvas" label="Open canvas" />
        </button>
      </Match>
      <Match when={props.content != null}>
        <Frame>
          <pre class="file-detail-snippet">{props.content}</pre>
        </Frame>
      </Match>
      <Match when={props.file.isImage && props.file.thumbUrl}>
        <Frame>
          <ConstrainedImage
            alt={name()}
            class="file-detail-image"
            fullSrc={resolveMediaUrl(props.file.urlPrivate)}
            height={image().height}
            src={props.file.thumbUrl ?? ""}
            width={image().width}
          />
        </Frame>
      </Match>
      <Match when={props.file.isVideo}>
        <Frame>
          <VideoPlayer
            ariaLabel={name()}
            captionsSrc={props.file.vtt}
            class="file-detail-video"
            downloadHref={props.file.urlPrivateDownload}
            downloadName={props.file.name}
            duration={props.file.duration}
            height={props.file.height}
            openHref={props.file.urlPrivate}
            poster={props.file.thumbUrl}
            ref={setVideo}
            src={resolveMediaUrl(props.file.urlPrivate)}
            toolbarExtra={
              <Show when={props.file.transcriptionPreview}>
                <TranscriptPopover
                  file={props.file}
                  media={video}
                  triggerClass="video-player-chrome"
                />
              </Show>
            }
            width={props.file.width}
          />
        </Frame>
      </Match>
      <Match when={props.file.isAudio}>
        <Frame>
          <AudioFile file={props.file} />
        </Frame>
      </Match>
      <Match when={props.file.isPdf || props.file.isMail}>
        <FileViewerTrigger file={props.file} kind={props.file.isPdf ? "pdf" : "mail"}>
          <ActionLabel icon={props.file.isPdf ? "pdf-file" : "email"} label="Open preview" />
        </FileViewerTrigger>
      </Match>
    </Switch>
  );
}
