import { Mrkdwn } from "@slock/blockkit";
import { Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import type { SlackFile } from "../../../../lib/api";
import "./MessageFiles.css";

export function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileCardInfo(props: {
  file: SlackFile;
  icon: IconName;
  mrkdwnTitle?: boolean;
}) {
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
