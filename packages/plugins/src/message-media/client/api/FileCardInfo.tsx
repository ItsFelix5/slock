import { EmojiText, Mrkdwn } from "@slock/blockkit";
import { fileKindLabel, isCanvasFile } from "@slock/plugins/files/client/api/fileSummary";
import type { SlackFile } from "@slock/types";
import { formatSize, Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import "./MessageFiles.css";

export default function FileCardInfo(props: {
  file: SlackFile;
  icon: IconName;
  mrkdwnTitle?: boolean;
  linkUrl?: string;
}) {
  const name = () => props.file.title || props.file.name;
  return (
    <Show
      fallback={
        <>
          <Icon name="trash" size={20} />
          <span class="message-file-info flex-col">
            <span class="message-file-name truncate">Deleted file</span>
          </span>
        </>
      }
      when={!props.file.isDeleted}
    >
      <Icon name={props.icon} size={20} />
      <span class="message-file-info flex-col">
        <span class="message-file-name truncate" data-link-url={props.linkUrl}>
          <Show fallback={<EmojiText text={name()} />} when={props.mrkdwnTitle}>
            <Mrkdwn text={name()} />
          </Show>
        </span>
        <span class="message-file-meta meta-dim">
          {fileKindLabel(props.file)} {isCanvasFile(props.file) ? "" : formatSize(props.file.size)}
        </span>
      </span>
    </Show>
  );
}
