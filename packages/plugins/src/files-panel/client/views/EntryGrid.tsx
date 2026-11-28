import { EmojiText, safeMediaUrl, safeUrl } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import FileThumb from "@slock/plugins/files/client/api/FileThumb";
import {
  fileKindLabel,
  formatFileDate,
  isCanvasFile,
} from "@slock/plugins/files/client/api/fileSummary";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import { mentionText } from "@slock/plugins/users/client/api";
import type { ChannelId, SlackFile, SlackLink } from "@slock/types";
import { formatSize, Icon, imageSrc } from "@slock/ui";
import { For, Show } from "solid-js";
import type { FilesLinksEntry } from "../api";
import { linkDomain } from "../lib/panelView";

const filesPanel = service("files-panel");
const messageLinks = service("message-links");

function JumpButton(props: { onJump: () => void; onSplit: () => void }) {
  return (
    <SplitNavigation onSplit={props.onSplit}>
      <button class="files-links-card-jump btn-reset hover-hl" onClick={props.onJump} type="button">
        <Icon name="message" size={13} />
      </button>
    </SplitNavigation>
  );
}

function FileCard(props: {
  channelId: ChannelId;
  file: SlackFile;
  onOpen: (file: SlackFile) => void;
}) {
  return (
    <div class="files-links-card files-links-card-jumpable">
      <button
        class="files-links-card-open btn-reset"
        data-nav-row
        onClick={() => props.onOpen(props.file)}
        tabindex={-1}
        type="button"
      >
        <FileThumb
          file={props.file}
          iconClass="files-links-card-icon"
          iconSize={26}
          imageClass="files-links-card-thumb"
        />
        <span class="files-links-card-body flex-col">
          <span class="files-links-card-title truncate">
            <EmojiText text={mentionText(props.file.title || props.file.name)} />
          </span>
          <span class="files-links-card-meta text-dim truncate">
            {[
              fileKindLabel(props.file),
              isCanvasFile(props.file) ? "" : formatSize(props.file.size),
              formatFileDate(props.file.created),
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
          filesPanel.openFileMessage(
            props.channelId,
            props.file.id,
            messageLinks.openMessageInSplit,
          )
        }
      />
    </div>
  );
}

function LinkCard(props: { channelId: ChannelId; link: SlackLink }) {
  return (
    <div class="files-links-card files-links-card-jumpable">
      <a
        class="files-links-card-open"
        data-nav-row
        href={safeUrl(props.link.url)}
        rel="noopener noreferrer"
        tabindex={-1}
        target="_blank"
      >
        <Show
          fallback={
            <span class="files-links-card-icon flex-center">
              <Icon name="link" size={22} />
            </span>
          }
          when={safeMediaUrl(props.link.iconUrl ?? props.link.thumbUrl)}
        >
          {(icon) => (
            <img
              alt=""
              class="files-links-card-favicon"
              decoding="async"
              loading="lazy"
              src={imageSrc(icon())}
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
          filesPanel.openLinkMessage(
            props.channelId,
            props.link.ts,
            messageLinks.openMessageInSplit,
          )
        }
      />
    </div>
  );
}

export function EntryGrid(props: {
  channelId: ChannelId;
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
