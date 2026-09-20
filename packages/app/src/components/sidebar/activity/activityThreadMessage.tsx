import { BlockKit, formatTime, Mrkdwn } from "@slock/blockkit";
import type { Block } from "@slock/types";
import { Avatar, DEFAULT_AVATAR_COLOR, Icon, Tooltip } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { formatDayFromMs, type SlackFile } from "../../../lib/api";
import { fileSummaryIcon, fileSummaryLabel } from "../../../lib/fileSummary";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import {
  isRealUserId,
  type MessageAuthorFields,
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
  unresolvedAuthorFallback,
} from "../../messages/parts/messageRenderState";
import { ClickableAuthorName } from "../../user/AppBadge";

export function ActivityMessageText(props: {
  blocks?: Block[];
  files?: SlackFile[];
  text: string;
}) {
  const ref = createMemo(() => parseReplyLink(props.text));
  const renderBlocks = createMemo(() => (props.blocks?.length ? props.blocks : undefined));
  const filesOnly = createMemo(() => {
    if (props.text.trim() || renderBlocks()) return;
    return props.files?.length ? props.files : undefined;
  });
  return (
    <Show
      fallback={
        <Show
          fallback={
            <Show fallback={<Mrkdwn inline text={props.text} />} when={renderBlocks()}>
              {(blocks) => <BlockKit blocks={blocks()} />}
            </Show>
          }
          when={filesOnly()}
        >
          {(files) => (
            <span class="activity-file-fallback">
              <Icon name={fileSummaryIcon(files())} size={12} />
              {fileSummaryLabel(files())}
            </span>
          )}
        </Show>
      }
      when={ref()}
    >
      {(r) => <Mrkdwn inline text={r().rest} />}
    </Show>
  );
}

export function ThreadMessageRow(props: {
  author: MessageAuthorFields;
  blocks?: Block[];
  eventLabel?: JSX.Element;
  files?: SlackFile[];
  isFirst?: boolean;
  isLast?: boolean;
  isRoot?: boolean;
  onContextMenu?: (e: MouseEvent) => void;
  onOpen: () => void;
  text: string;
  time?: number;
  unread?: boolean;
}) {
  const user = createMemo(() => store.users.userById(props.author.userId));
  const displayName = createMemo(() =>
    resolveAuthorDisplayName(props.author, user()?.name, unresolvedAuthorFallback(props.author)),
  );
  const avatarUrl = createMemo(() => resolveAuthorAvatarUrl(props.author, user()?.avatarUrl));
  const profileUserId = createMemo(() => {
    const id = resolveProfileUserId(props.author);
    return isRealUserId(id) ? id : undefined;
  });
  const avatar = () => (
    <Avatar
      size="small"
      user={{
        avatarColor: user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
        avatarUrl: avatarUrl(),
        id: props.author.userId,
        name: displayName(),
        presence: user()?.presence,
      }}
    />
  );
  return (
    <button
      class="activity-thread-message btn-reset"
      classList={{
        "activity-thread-line-end": props.isLast,
        "activity-thread-line-start": props.isFirst,
        "activity-thread-root": props.isRoot,
        unread: props.unread,
      }}
      data-nav-row
      onClick={props.onOpen}
      onContextMenu={props.onContextMenu}
      tabIndex={-1}
      type="button"
    >
      <span class="activity-thread-avatar">
        <Show fallback={avatar()} when={profileUserId()}>
          {(id) => <ClickableAuthorName userId={id()}>{avatar()}</ClickableAuthorName>}
        </Show>
      </span>
      <span class="activity-thread-message-body">
        <span class="activity-thread-message-head flex-align-center">
          <Show fallback={<strong>{displayName()}</strong>} when={profileUserId()}>
            {(id) => (
              <ClickableAuthorName userId={id()}>
                <strong>{displayName()}</strong>
              </ClickableAuthorName>
            )}
          </Show>
          <Show when={props.eventLabel}>
            <span class="activity-thread-event">{props.eventLabel}</span>
          </Show>
          <Show keyed when={props.time === undefined ? undefined : props.time}>
            {(time) => (
              <Tooltip content={`${formatDayFromMs(time)} at ${formatTime(time)}`}>
                <span class="activity-thread-message-time">{formatTime(time)}</span>
              </Tooltip>
            )}
          </Show>
        </span>
        <span class="activity-thread-message-text">
          <ActivityMessageText blocks={props.blocks} files={props.files} text={props.text} />
        </span>
      </span>
    </button>
  );
}
