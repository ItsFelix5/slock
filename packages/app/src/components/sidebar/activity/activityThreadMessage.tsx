import { BlockKit, formatTime, Link, Mrkdwn } from "@slock/blockkit";
import type { Block, RichTextBlock } from "@slock/types";
import { Avatar, DEFAULT_AVATAR_COLOR, Tooltip } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { formatDayFromMs } from "../../../lib/api";
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
import ClickableAuthorName from "../../user/ClickableAuthorName";

export function ActivityMessageText(props: { blocks?: Block[]; text: string }) {
  const ref = createMemo(() => parseReplyLink(props.text));
  const richTextBlocks = createMemo(() =>
    (props.blocks ?? []).filter((block): block is RichTextBlock => block.type === "rich_text"),
  );
  return (
    <Show
      fallback={
        <Show fallback={<Mrkdwn text={props.text} />} when={richTextBlocks().length > 0}>
          <BlockKit blocks={richTextBlocks()} />
        </Show>
      }
      when={ref()}
    >
      {(r) => (
        <>
          <Link label="Original message" url={r().url} />
          <Show when={r().rest.trim()}>
            <Mrkdwn text={r().rest} />
          </Show>
        </>
      )}
    </Show>
  );
}

export function ThreadMessageRow(props: {
  author: MessageAuthorFields;
  blocks?: Block[];
  eventLabel?: JSX.Element;
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
          <Show when={props.time !== undefined}>
            <Tooltip
              content={`${formatDayFromMs(props.time as number)} at ${formatTime(props.time as number)}`}
            >
              <span class="activity-thread-message-time">{formatTime(props.time as number)}</span>
            </Tooltip>
          </Show>
        </span>
        <span class="activity-thread-message-text">
          <ActivityMessageText blocks={props.blocks} text={props.text} />
        </span>
      </span>
    </button>
  );
}
