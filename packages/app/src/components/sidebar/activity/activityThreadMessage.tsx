import { EmojiText, Mrkdwn } from "@slock/blockkit";
import type { ActivityItem, Message } from "@slock/slack-api";
import { Avatar } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { store } from "../../../lib/store";

export function formatTime(time: number) {
  return new Date(time).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ThreadMessageRow(props: {
  eventLabel?: JSX.Element;
  isRoot?: boolean;
  onOpen: () => void;
  text: string;
  time?: number;
  unread?: boolean;
  userId: string;
}) {
  const user = createMemo(() => store.users.userById(props.userId));
  return (
    <button
      class="activity-thread-message btn-reset"
      classList={{ "activity-thread-root": props.isRoot, unread: props.unread }}
      onClick={props.onOpen}
      type="button"
    >
      <span class="activity-thread-avatar">
        <Show when={user()}>
          {(person) => (
            <Avatar
              size="small"
              user={{ ...person(), avatarColor: person().avatarColor ?? "#616061" }}
            />
          )}
        </Show>
      </span>
      <span class="activity-thread-message-body">
        <span class="activity-thread-message-head flex-align-center">
          <strong>{user()?.name ?? "Someone"}</strong>
          <Show when={props.eventLabel}>
            <span class="activity-thread-event">{props.eventLabel}</span>
          </Show>
          <Show when={props.time !== undefined}>
            <span class="activity-thread-message-time">{formatTime(props.time as number)}</span>
          </Show>
        </span>
        <span class="activity-thread-message-text">
          <Mrkdwn text={props.text} />
        </span>
      </span>
    </button>
  );
}

export function ThreadActivityMessage(props: { item: ActivityItem; onOpen: () => void }) {
  const unread = createMemo(() => store.activity.isActivityItemUnread(props.item));
  return (
    <ThreadMessageRow
      eventLabel={
        props.item.kind === "reaction" && props.item.reactionName ? (
          <>
            reacted <EmojiText text={`:${props.item.reactionName}:`} />
          </>
        ) : undefined
      }
      onOpen={props.onOpen}
      text={props.item.text}
      time={props.item.time}
      unread={unread()}
      userId={props.item.userId}
    />
  );
}

export function ThreadRootMessage(props: { message: Message; onOpen: () => void }) {
  return (
    <ThreadMessageRow
      eventLabel="started the thread"
      isRoot
      onOpen={props.onOpen}
      text={props.message.text}
      userId={props.message.userId}
    />
  );
}

export function ThreadBundleMessage(props: { message: Message; onOpen: () => void }) {
  return (
    <ThreadMessageRow
      onOpen={props.onOpen}
      text={props.message.text}
      time={parseFloat(props.message.ts) * 1000}
      unread
      userId={props.message.userId}
    />
  );
}
