import { EmojiText } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { SlackFile, SlackLink } from "@slock/types";
import { Icon, Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import { openConversationInSplit } from "../../../conversations/client/api/nav";
import { fileIconName, fileKindLabel, isCanvasFile } from "../../../files/client/api/fileSummary";
import { formatSize } from "../../../message-media/client/api/FileCardInfo";
import { SplitNavigation } from "../../../shell/client/api/SplitNavigation";
import type { FilesLinksEntry } from "../api";
import { formatDate, linkDomain } from "../lib/panelView";

const filesPanel = service("files-panel");

function JumpButton(props: { onJump: () => void; onSplit: () => void }) {
  return (
    <Tooltip content="Jump to message">
      <SplitNavigation onSplit={props.onSplit}>
        <button
          class="files-links-card-jump btn-reset hover-hl"
          onClick={props.onJump}
          type="button"
        >
          <Icon name="message" size={13} />
        </button>
      </SplitNavigation>
    </Tooltip>
  );
}

function FileCard(props: {
  channelId: string;
  file: SlackFile;
  onOpen: (file: SlackFile) => void;
}) {
  return (
    <div class="files-links-card files-links-card-jumpable">
      <button
        class="files-links-card-open btn-reset"
        data-nav-row
        onClick={() => props.onOpen(props.file)}
        tabIndex={-1}
        type="button"
      >
        <Show
          fallback={
            <span class="files-links-card-icon flex-center">
              <Icon name={fileIconName(props.file)} size={26} />
            </span>
          }
          when={props.file.isImage && props.file.thumbUrl}
        >
          {(thumb) => (
            <img
              alt=""
              class="files-links-card-thumb"
              decoding="async"
              loading="lazy"
              src={thumb()}
            />
          )}
        </Show>
        <span class="files-links-card-body flex-col">
          <span class="files-links-card-title truncate">
            <EmojiText text={props.file.title || props.file.name} />
          </span>
          <span class="files-links-card-meta text-dim truncate">
            {[
              fileKindLabel(props.file),
              isCanvasFile(props.file) ? "" : formatSize(props.file.size),
              formatDate(props.file.created),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </button>
      <JumpButton
        onJump={() =>
          filesPanel.openFileMessage(
            props.channelId,
            props.file.id,
            filesPanel.jumpToFilesLinksMessage,
          )
        }
        onSplit={() =>
          filesPanel.openFileMessage(props.channelId, props.file.id, openConversationInSplit)
        }
      />
    </div>
  );
}

function LinkCard(props: { channelId: string; link: SlackLink }) {
  return (
    <div class="files-links-card files-links-card-jumpable">
      <a
        class="files-links-card-open"
        data-nav-row
        href={props.link.url}
        rel="noopener noreferrer"
        tabIndex={-1}
        target="_blank"
      >
        <Show
          fallback={
            <span class="files-links-card-icon flex-center">
              <Icon name="link" size={22} />
            </span>
          }
          when={props.link.iconUrl ?? props.link.thumbUrl}
        >
          {(icon) => (
            <img
              alt=""
              class="files-links-card-favicon"
              decoding="async"
              loading="lazy"
              src={icon()}
            />
          )}
        </Show>
        <span class="files-links-card-body flex-col">
          <span class="files-links-card-title truncate">{props.link.title || props.link.url}</span>
          <span class="files-links-card-meta text-dim truncate">{linkDomain(props.link.url)}</span>
        </span>
      </a>
      <JumpButton
        onJump={() =>
          filesPanel.openLinkMessage(
            props.channelId,
            props.link.ts,
            filesPanel.jumpToFilesLinksMessage,
          )
        }
        onSplit={() =>
          filesPanel.openLinkMessage(props.channelId, props.link.ts, openConversationInSplit)
        }
      />
    </div>
  );
}

export function EntryGrid(props: {
  channelId: string;
  entries: FilesLinksEntry[];
  onOpenFile: (file: SlackFile) => void;
}) {
  return (
    <div class="files-links-grid">
      <For each={props.entries}>
        {(entry) =>
          entry.kind === "file" ? (
            <FileCard channelId={props.channelId} file={entry.file} onOpen={props.onOpenFile} />
          ) : (
            <LinkCard channelId={props.channelId} link={entry.link} />
          )
        }
      </For>
    </div>
  );
}
