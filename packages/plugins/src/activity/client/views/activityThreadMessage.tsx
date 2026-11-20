import { formatDayFromMs, formatTimeFromMs } from "@slock/core";
import { service } from "@slock/core/solid";
import type { Block, ChannelId, SlackFile, Ts } from "@slock/types";
import { Avatar, DEFAULT_AVATAR_COLOR, NavRow, Tooltip } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { splitReplyLink } from "../../../message-links/client/api/replyLink";
import MessageReferenceSnippet from "../../../messages/client/api/cards/MessageReferenceSnippet";
import {
  isRealUserId,
  type MessageAuthorFields,
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveProfileUserId,
  unresolvedAuthorFallback,
} from "../../../messages/client/api/messageAuthor";
import { ClickableAuthorName } from "../../../profile/client/api/AppBadge";

const usersStore = service("users");

export function ActivityMessageText(props: {
  author: MessageAuthorFields;
  blocks?: Block[];
  channelId: ChannelId;
  files?: SlackFile[];
  text: string;
  threadTs?: Ts;
  ts: Ts;
}) {
  const content = createMemo(() => splitReplyLink(props));
  return (
    <MessageReferenceSnippet
      blocks={content().blocks}
      botId={props.author.botId}
      botUserId={props.author.userId}
      channelId={props.channelId}
      files={props.files}
      inline
      text={content().text}
      threadTs={props.threadTs}
      ts={props.ts}
    />
  );
}

export function ThreadMessageRow(props: {
  author: MessageAuthorFields;
  blocks?: Block[];
  channelId: ChannelId;
  files?: SlackFile[];
  isFirst?: boolean;
  isLast?: boolean;
  isRoot?: boolean;
  onContextMenu?: (e: MouseEvent) => void;
  onOpen: () => void;
  text: string;
  threadTs: Ts;
  ts: Ts;
  unread?: boolean;
}) {
  const timeMs = () => parseFloat(props.ts) * 1000;
  const user = createMemo(() => {
    const id = props.author.userId;
    return id ? usersStore.userById(id) : undefined;
  });
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
        id: props.author.userId ?? "",
        name: displayName(),
        presence: user()?.presence,
      }}
    />
  );
  return (
    <NavRow
      class={[
        "activity-thread-message",
        {
          "activity-thread-line-end": props.isLast,
          "activity-thread-line-start": props.isFirst,
          "activity-thread-root": props.isRoot,
          unread: props.unread,
        },
      ]}
      onActivate={props.onOpen}
      onContextMenu={props.onContextMenu}
      tabindex={-1}
    >
      <span class="activity-thread-avatar">
        <Show fallback={avatar()} when={profileUserId()}>
          {(id) => <ClickableAuthorName userId={id()}>{avatar()}</ClickableAuthorName>}
        </Show>
      </span>
      <span class="activity-thread-message-body">
        <span class="activity-thread-message-head flex-align-center">
          <Show fallback={<strong class="truncate">{displayName()}</strong>} when={profileUserId()}>
            {(id) => (
              <ClickableAuthorName userId={id()}>
                <strong class="truncate">{displayName()}</strong>
              </ClickableAuthorName>
            )}
          </Show>
          <Tooltip content={`${formatDayFromMs(timeMs())} at ${formatTimeFromMs(timeMs())}`}>
            <span class="activity-thread-message-time meta-dim">{formatTimeFromMs(timeMs())}</span>
          </Tooltip>
        </span>
        <span class="activity-thread-message-text">
          <ActivityMessageText
            author={props.author}
            blocks={props.blocks}
            channelId={props.channelId}
            files={props.files}
            text={props.text}
            threadTs={props.threadTs}
            ts={props.ts}
          />
        </span>
      </span>
    </NavRow>
  );
}
