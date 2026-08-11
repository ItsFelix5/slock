import { fetchFileDetail, resolveMediaUrl, type SlackFile } from "@slock/slack-api";
import { ConstrainedImage, Icon, Overlay, PanelHeader, VideoPlayer } from "@slock/ui";
import { createResource, For, Match, Show, Switch } from "solid-js";
import { closeFilesLinksPanel } from "../../lib/filesLinksPanel";
import { store } from "../../lib/store";
import AudioFile from "../messages/parts/media/AudioFile";
import FileViewerTrigger from "../messages/parts/media/FileViewer";
import { formatSize } from "../messages/parts/media/MessageFiles";
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

  const jumpToShare = (channelId: string, ts: string) => {
    props.onClose();
    closeFilesLinksPanel();
    store.viewState.openChannelMessage(channelId, ts, { keepNav: true });
  };

  const openCanvas = () => {
    props.onClose();
    store.canvas.openFileCanvas(props.file.id, props.file.title || props.file.name);
  };

  return (
    <Overlay ariaLabel={props.file.title || props.file.name} onClose={props.onClose}>
      <div class="file-detail-card flex-col">
        <PanelHeader onClose={props.onClose} title={props.file.title || props.file.name} />
        <div class="file-detail-body flex-col">
          <div class="file-detail-preview">
            <Switch
              fallback={
                <a
                  class="file-detail-fallback flex-col"
                  href={props.file.urlPrivate}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Icon name="file" size={40} />
                  <span>Open file</span>
                </a>
              }
            >
              <Match when={detail()?.content != null}>
                <pre class="file-detail-snippet">{detail()?.content}</pre>
              </Match>
              <Match when={props.file.isImage && props.file.thumbUrl}>
                <ConstrainedImage
                  alt={props.file.title || props.file.name}
                  class="file-detail-image"
                  fullSrc={resolveMediaUrl(props.file.urlPrivate)}
                  height={props.file.height || 480}
                  src={props.file.thumbUrl ?? ""}
                  width={props.file.width || 640}
                />
              </Match>
              <Match when={props.file.isVideo}>
                <VideoPlayer
                  ariaLabel={props.file.title || props.file.name}
                  height={props.file.height}
                  openHref={props.file.urlPrivate}
                  poster={props.file.thumbUrl}
                  src={resolveMediaUrl(props.file.urlPrivate)}
                  width={props.file.width}
                />
              </Match>
              <Match when={props.file.isAudio}>
                <AudioFile file={props.file} />
              </Match>
              <Match when={props.file.isPdf || props.file.isMail}>
                <FileViewerTrigger file={props.file} kind={props.file.isPdf ? "pdf" : "mail"}>
                  <Icon name={props.file.isPdf ? "pdf-file" : "email"} size={40} />
                  <span>Open preview</span>
                </FileViewerTrigger>
              </Match>
              <Match when={props.file.isCanvas}>
                <button class="file-detail-fallback btn-reset" onClick={openCanvas} type="button">
                  <Icon name="canvas-content" size={40} />
                  <span>Open canvas</span>
                </button>
              </Match>
            </Switch>
          </div>
          <div class="file-detail-meta text-dim">
            {[
              props.file.filetype?.toUpperCase(),
              formatSize(props.file.size),
              formatDateTime(props.file.created),
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
