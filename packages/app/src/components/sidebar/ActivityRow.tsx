import { EmojiText, Mrkdwn } from "@slock/blockkit";
import type { ActivityItem } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  findActivityMessage,
  hasUserReacted,
  hasUserResponded,
} from "../../lib/activityInteractions";
import {
  channelById,
  channelDisplayName,
  currentUser,
  isActivityComplete,
  isActivityItemUnread,
  isPingingActivity,
  messagesByChannel,
  threadMessages,
  toggleActivityComplete,
  userById,
} from "../../lib/store";

export interface ActivityRow {
  key: string;
  items: ActivityItem[];
  isThread: boolean;
}

export function rowTarget(row: ActivityRow) {
  const latest = row.items[0];
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

function verbFor(item: ActivityItem): string {
  switch (item.kind) {
    case "mention":
      return "mentioned you in";
    case "dm":
      return "sent you a message";
    case "keyword":
      return item.matchedKeyword ? `said "${item.matchedKeyword}" in` : "used a pingword in";
    case "thread_reply":
      return "replied to a thread in";
    case "channel_mention":
      return `mentioned @${item.broadcastRange ?? "channel"} in`;
    case "usergroup_mention":
      return "mentioned a usergroup in";
    case "channel_all":
      return "posted in";
    default:
      return "reacted to your message in";
  }
}

const REPLIES_SHOWN_COLLAPSED = 3;

// A single reply within an expanded thread group — its own tiny avatar,
// author, snippet, and read state, so "N people replied" becomes something
// you can actually triage without opening the thread.
function ThreadReplyRow(props: { item: ActivityItem; onOpen: () => void }) {
  const user = createMemo(() => userById(props.item.userId));
  const unread = createMemo(() => isActivityItemUnread(props.item));
  return (
    <button
      type="button"
      class="activity-thread-reply"
      classList={{ unread: unread() }}
      onClick={(e) => {
        e.stopPropagation();
        props.onOpen();
      }}
    >
      <Show when={user()}>
        {(u) => (
          <Avatar user={{ ...u(), avatarColor: u().avatarColor ?? "#616061" }} size="small" />
        )}
      </Show>
      <span class="activity-thread-reply-author">{user()?.name ?? "Someone"}</span>
      <span class="activity-thread-reply-snippet">
        <Mrkdwn text={props.item.text} />
      </span>
    </button>
  );
}

export default function ActivityRow(props: {
  row: ActivityRow;
  onOpen: (channelId: string, ts: string) => void;
  onMarkRead: (channelId: string, ts: string) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const latest = createMemo(() => props.row.items[0]);
  const user = createMemo(() => userById(latest().userId));
  const channel = createMemo(() => channelById(latest().channelId));
  const isUnread = createMemo(() => props.row.items.some(isActivityItemUnread));
  const isPinging = createMemo(() => isPingingActivity(latest()));
  const isComplete = createMemo(() => isActivityComplete(latest().id));
  const replierIds = createMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of props.row.items) {
      if (!seen.has(item.userId)) {
        seen.add(item.userId);
        ids.push(item.userId);
      }
    }
    return ids;
  });
  const isThreadGroup = createMemo(() => props.row.isThread && props.row.items.length > 1);

  // Oldest-first so the reply list reads top-to-bottom like the thread itself.
  const orderedReplies = createMemo(() => [...props.row.items].reverse());
  const visibleReplies = createMemo(() =>
    expanded() ? orderedReplies() : orderedReplies().slice(-REPLIES_SHOWN_COLLAPSED),
  );
  const hiddenReplyCount = createMemo(() =>
    Math.max(0, orderedReplies().length - visibleReplies().length),
  );

  // The thread's root message, for "replying to: ..." context — best-effort,
  // only available once that channel has been loaded into the store this
  // session (see findActivityMessage).
  const rootMessage = createMemo(() => {
    if (!isThreadGroup()) return undefined;
    const threadTs = latest().threadTs;
    if (!threadTs) return undefined;
    return messagesByChannel[latest().channelId]?.find((m) => m.ts === threadTs);
  });

  const reacted = createMemo(() =>
    hasUserReacted(
      findActivityMessage(latest(), messagesByChannel, threadMessages),
      currentUser()?.id,
    ),
  );
  const responded = createMemo(() =>
    hasUserResponded(latest(), messagesByChannel, threadMessages, currentUser()?.id),
  );

  const markRead = (e: MouseEvent) => {
    e.stopPropagation();
    props.onMarkRead(latest().channelId, latest().ts);
  };

  const toggleComplete = (e: MouseEvent) => {
    e.stopPropagation();
    toggleActivityComplete(latest().id);
  };

  const formatInteractorNames = (ids: string[]) => {
    const names = ids.map((id) =>
      id === currentUser()?.id ? "you" : (userById(id)?.name ?? "someone"),
    );
    return names.reduce(
      (prev, curr, i, a) => (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
      "",
    );
  };

  return (
    <div class="activity-item-wrap">
      <button
        type="button"
        class="activity-item"
        classList={{
          unread: isUnread(),
          pinging: isPinging(),
          complete: isComplete(),
          "activity-item-thread": props.row.isThread,
        }}
        onClick={() => props.onOpen(latest().channelId, rowTarget(props.row).ts)}
      >
        <Show
          when={isThreadGroup()}
          fallback={
            <Show when={user()}>
              {(u) => (
                <Avatar user={{ ...u(), avatarColor: u().avatarColor ?? "#616061" }} size="small" />
              )}
            </Show>
          }
        >
          <AvatarStack
            users={replierIds()
              .slice(0, 3)
              .map((id) => userById(id))
              .filter((u) => u !== undefined)}
            title={() => formatInteractorNames(replierIds())}
          />
        </Show>
        <div class="activity-body">
          <div class="activity-headline">
            <Show when={isThreadGroup()} fallback={<strong>{user()?.name ?? "Someone"}</strong>}>
              <strong>{formatInteractorNames(replierIds())}</strong>
            </Show>
            <span class="activity-verb">{verbFor(latest())}</span>
            <Show when={latest().kind !== "dm"}>
              <span class="activity-channel">
                #{channelDisplayName(channel(), latest().channelId)}
              </span>
            </Show>
            <Show when={isThreadGroup()}>
              <span class="activity-reply-count">{props.row.items.length} replies</span>
            </Show>
            <Show when={latest().kind === "reaction" && latest().reactionName}>
              <span class="activity-reaction">
                <EmojiText text={`:${latest().reactionName}:`} />
              </span>
            </Show>
            <Show when={reacted()}>
              <span class="activity-badge" title="You reacted to this">
                <Icon name="emoji-filled" size={12} />
              </span>
            </Show>
            <Show when={responded()}>
              <span class="activity-badge" title="You replied to this">
                <Icon name="email-reply" size={12} />
              </span>
            </Show>
            <Show when={isComplete()}>
              <span class="activity-badge activity-badge-complete" title="Marked as complete">
                <Icon name="check-circle-filled" size={12} />
              </span>
            </Show>
          </div>

          <Show
            when={isThreadGroup()}
            fallback={
              <div class="activity-snippet">
                <Mrkdwn text={latest().text} />
              </div>
            }
          >
            <Show when={rootMessage()}>
              {(root) => (
                <div class="activity-thread-root">
                  <Mrkdwn text={root().text} />
                </div>
              )}
            </Show>
            <div class="activity-thread-replies">
              <For each={visibleReplies()}>
                {(item) => (
                  <ThreadReplyRow
                    item={item}
                    onOpen={() => props.onOpen(item.channelId, rowTarget(props.row).ts)}
                  />
                )}
              </For>
            </div>
            <Show when={hiddenReplyCount() > 0}>
              <button
                type="button"
                class="activity-show-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
              >
                Show {hiddenReplyCount()} more {hiddenReplyCount() === 1 ? "reply" : "replies"}
              </button>
            </Show>
          </Show>

          <div class="activity-time">
            {new Date(latest().time).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
      </button>
      <button
        type="button"
        class="activity-complete-toggle"
        classList={{ active: isComplete() }}
        title={isComplete() ? "Mark as not complete" : "Mark as complete"}
        onClick={toggleComplete}
      >
        <Icon name={isComplete() ? "check-circle-filled" : "check-circle"} size={15} />
      </button>
      <Show when={isUnread()} fallback={<span class="activity-unread-dot" />}>
        <button
          type="button"
          class="activity-unread-dot unread"
          title="Mark as read"
          onClick={markRead}
        />
      </Show>
    </div>
  );
}
