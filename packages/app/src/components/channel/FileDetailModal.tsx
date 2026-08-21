import { formatDuration } from "@slock/blockkit";
import { ConstrainedImage, Icon, Overlay, PanelHeader, VideoPlayer } from "@slock/ui";
import { createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { fetchFileDetail, resolveMediaUrl, type SlackFile } from "../../lib/api";
import { closeFilesLinksPanel } from "../../lib/filesLinksPanel";
import { store } from "../../lib/store";
import AudioFile from "../messages/parts/media/AudioFile";
import FileViewerTrigger from "../messages/parts/media/FileViewer";
import { formatSize } from "../messages/parts/media/MessageFiles";
import TranscriptPopover from "../messages/parts/media/TranscriptPopover";
import "./FileDetailModal.css";

function formatDateTime(value: number | string | undefined): string {
  const seconds = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function FileDetailModal(props: { file: SlackFile; onClose: () => void }) {
  const [detail] = createResource(() => props.file.id, fetchFileDetail);
  const file = () => detail()?.file ?? props.file;
  const [video, setVideo] = createSignal<HTMLVideoElement>();

  const jumpToShare = (channelId: string, ts: string) => {
    props.onClose();
    closeFilesLinksPanel();
    store.viewState.openChannelMessage(channelId, ts, { keepNav: true });
  };

  return (
    <Overlay ariaLabel={file().title || file().name} onClose={props.onClose}>
      <div class="file-detail-card flex-col">
        <PanelHeader onClose={props.onClose} title={file().title || file().name} />
        <div class="file-detail-body flex-col">
          <div class="file-detail-preview">
            <Switch
              fallback={
                <Show
                  fallback={
                    <div class="file-detail-fallback flex-col">
                      <Icon name="file" size={40} />
                      <span>{detail.error ? "File is no longer available" : "Loading file…"}</span>
                    </div>
                  }
                  when={file().urlPrivate}
                >
                  <a
                    class="file-detail-fallback flex-col"
                    href={file().urlPrivate}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon name="file" size={40} />
                    <span>Open file</span>
                  </a>
                </Show>
              }
            >
              <Match when={detail()?.content != null}>
                <pre class="file-detail-snippet">{detail()?.content}</pre>
              </Match>
              <Match when={file().isImage && file().thumbUrl}>
                <ConstrainedImage
                  alt={file().title || file().name}
                  class="file-detail-image"
                  fullSrc={resolveMediaUrl(file().urlPrivate)}
                  height={file().height || 480}
                  src={file().thumbUrl ?? ""}
                  width={file().width || 640}
                />
              </Match>
              <Match when={file().isVideo}>
                <VideoPlayer
                  ariaLabel={file().title || file().name}
                  captionsSrc={file().vtt}
                  class="file-detail-video"
                  duration={file().duration}
                  height={file().height}
                  openHref={file().urlPrivate}
                  poster={file().thumbUrl}
                  ref={setVideo}
                  src={resolveMediaUrl(file().urlPrivate)}
                  toolbarExtra={
                    <Show when={file().transcriptionPreview}>
                      <TranscriptPopover
                        file={file()}
                        media={video}
                        triggerClass="video-player-chrome"
                      />
                    </Show>
                  }
                  width={file().width}
                />
              </Match>
              <Match when={file().isAudio}>
                <AudioFile file={file()} />
              </Match>
              <Match when={file().isPdf || file().isMail}>
                <FileViewerTrigger file={file()} kind={file().isPdf ? "pdf" : "mail"}>
                  <Icon name={file().isPdf ? "pdf-file" : "email"} size={40} />
                  <span>Open preview</span>
                </FileViewerTrigger>
              </Match>
            </Switch>
          </div>
          <div class="file-detail-meta text-dim">
            {[
              file().filetype?.toUpperCase(),
              formatSize(file().size),
              file().isVideo && file().duration ? formatDuration(file().duration) : undefined,
              formatDateTime(file().created),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <Show when={detail.loading}>
            <div class="file-detail-shares-loading text-dim">Loading sharing history…</div>
          </Show>
          <Show when={(detail()?.shares.length ?? 0) > 0}>
            <div class="file-detail-shares">
              <div class="file-detail-shares-label text-dim">Shared in</div>
              <For each={detail()?.shares}>
                {(share) => (
                  <button
                    class="file-detail-share-row btn-reset"
                    onClick={() => jumpToShare(share.channelId, share.ts)}
                    type="button"
                  >
                    <span class="file-detail-share-channel truncate">#{share.channelName}</span>
                    <span class="file-detail-share-time text-dim">{formatDateTime(share.ts)}</span>
                    <Show when={share.replyCount}>
                      {(count) => (
                        <span class="file-detail-share-replies text-dim">{count()} replies</span>
                      )}
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Overlay>
  );
}
