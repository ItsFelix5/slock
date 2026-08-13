import { formatTime, Link, Mrkdwn } from "@slock/blockkit";
import { Avatar, DEFAULT_AVATAR_COLOR } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import {
  type MessageAuthorFields,
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  unresolvedAuthorFallback,
} from "../../messages/parts/messageRenderState";

export function ActivityMessageText(props: { text: string }) {
  const ref = createMemo(() => parseReplyLink(props.text));
  return (
    <Show fallback={<Mrkdwn text={props.text} />} when={ref()}>
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
  eventLabel?: JSX.Element;
  isFirst?: boolean;
  isLast?: boolean;
  isRoot?: boolean;
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
      type="button"
    >
      <span class="activity-thread-avatar">
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
      </span>
      <span class="activity-thread-message-body">
        <span class="activity-thread-message-head flex-align-center">
          <strong>{displayName()}</strong>
          <Show when={props.eventLabel}>
            <span class="activity-thread-event">{props.eventLabel}</span>
          </Show>
          <Show when={props.time !== undefined}>
            <span class="activity-thread-message-time">{formatTime(props.time as number)}</span>
          </Show>
        </span>
        <span class="activity-thread-message-text">
          <ActivityMessageText text={props.text} />
        </span>
      </span>
    </button>
  );
}
