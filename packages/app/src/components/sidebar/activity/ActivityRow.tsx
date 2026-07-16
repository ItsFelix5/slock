import { EmojiText, formatSlackDate, Mrkdwn } from "@slock/blockkit";
import type { ActivityItem } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  COMPLETE_EMOJI,
  findActivityMessage,
  hasUserReacted,
  hasUserReactedWith,
  hasUserResponded,
  toggleActivityComplete,
} from "../../../lib/activityInteractions";
import { channelDisplayName, isPingingActivity, store } from "../../../lib/store";
export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
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
function ThreadReplyRow(props: { item: ActivityItem; onOpen: () => void }) {
  const user = createMemo(() => store.users.userById(props.item.userId));
  const unread = createMemo(() => store.activity.isActivityItemUnread(props.item));
  return (
    <button
      class="activity-thread-reply btn-reset flex-align-center text-sm"
      classList={{ unread: unread() }}
      onClick={(e) => {
        e.stopPropagation();
        props.onOpen();
      }}
      type="button"
    >
      <Show when={user()}>
        {(u) => (
          <Avatar size="small" user={{ ...u(), avatarColor: u().avatarColor ?? "#616061" }} />
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
  const user = createMemo(() => store.users.userById(latest().userId));
  const channel = createMemo(() => store.channels.channelById(latest().channelId));
  const isUnread = createMemo(() => props.row.items.some(store.activity.isActivityItemUnread));
  const isPinging = createMemo(() => isPingingActivity(latest()));
  const isComplete = createMemo(() =>
    hasUserReactedWith(
      findActivityMessage(
        latest(),
        store.messages.messagesByChannel,
        store.messages.threadMessages,
      ),
      store.users.currentUser()?.id,
      COMPLETE_EMOJI,
    ),
  );
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
  const orderedReplies = createMemo(() => [...props.row.items].reverse());
  const visibleReplies = createMemo(() =>
    expanded() ? orderedReplies() : orderedReplies().slice(-REPLIES_SHOWN_COLLAPSED),
  );
  const hiddenReplyCount = createMemo(() =>
    Math.max(0, orderedReplies().length - visibleReplies().length),
  );
  const rootMessage = createMemo(() => {
    if (!isThreadGroup()) return;
    const threadTs = latest().threadTs;
    if (!threadTs) return;
    return store.messages.messagesByChannel[latest().channelId]?.find((m) => m.ts === threadTs);
  });
  const reacted = createMemo(() =>
    hasUserReacted(
      findActivityMessage(
        latest(),
        store.messages.messagesByChannel,
        store.messages.threadMessages,
      ),
      store.users.currentUser()?.id,
    ),
  );
  const responded = createMemo(() =>
    hasUserResponded(
      latest(),
      store.messages.messagesByChannel,
      store.messages.threadMessages,
      store.users.currentUser()?.id,
    ),
  );
  const markRead = (e: MouseEvent) => {
    e.stopPropagation();
    props.onMarkRead(latest().channelId, latest().ts);
  };
  const toggleComplete = (e: MouseEvent) => {
    e.stopPropagation();
    toggleActivityComplete(latest(), isComplete()).catch(() => {});
  };
  const formatInteractorNames = (ids: string[]) => {
    const names = ids.map((id) =>
      id === store.users.currentUser()?.id ? "you" : (store.users.userById(id)?.name ?? "someone"),
    );
    return names.reduce(
      (prev, curr, i, a) => (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
      "",
    );
  };
  return (
    <div class="activity-item-wrap">
      <button
        class="activity-item btn-reset flex-align-center"
        classList={{
          "activity-item-thread": props.row.isThread,
          complete: isComplete(),
          pinging: isPinging(),
          unread: isUnread(),
        }}
        onClick={() => props.onOpen(latest().channelId, rowTarget(props.row).ts)}
        type="button"
      >
        <Show
          fallback={
            <Show when={user()}>
              {(u) => (
                <Avatar size="small" user={{ ...u(), avatarColor: u().avatarColor ?? "#616061" }} />
              )}
            </Show>
          }
          when={isThreadGroup()}
        >
          <AvatarStack
            title={() => formatInteractorNames(replierIds())}
            users={replierIds()
              .slice(0, 3)
              .map((id) => store.users.userById(id))
              .filter((u) => u !== undefined)}
          />
        </Show>
        <div class="activity-body">
          <div class="activity-headline">
            <Show fallback={<strong>{user()?.name ?? "Someone"}</strong>} when={isThreadGroup()}>
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
            fallback={
              <div class="activity-snippet">
                <Mrkdwn text={latest().text} />
              </div>
            }
            when={isThreadGroup()}
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
                class="activity-show-more btn-reset link-action"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
                type="button"
              >
                Show {hiddenReplyCount()} more {hiddenReplyCount() === 1 ? "reply" : "replies"}
              </button>
            </Show>
          </Show>
          <div class="activity-time text-dim text-xs">{formatSlackDate(latest().time / 1000)}</div>
        </div>
      </button>
      <button
        class="activity-complete-toggle btn-reset flex-center text-dim"
        classList={{ active: isComplete() }}
        onClick={toggleComplete}
        title={isComplete() ? "Mark as not complete" : "Mark as complete"}
        type="button"
      >
        <Icon name={isComplete() ? "check-circle-filled" : "check-circle"} size={15} />
      </button>
      <Show fallback={<span class="activity-unread-dot" />} when={isUnread()}>
        <button
          class="activity-unread-dot unread"
          onClick={markRead}
          title="Mark as read"
          type="button"
        />
      </Show>
    </div>
  );
}
