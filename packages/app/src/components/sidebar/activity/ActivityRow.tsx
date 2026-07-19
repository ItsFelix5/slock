import { EmojiText, Mrkdwn } from "@slock/blockkit";
import type { ActivityItem } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon, Tooltip } from "@slock/ui";
import { createMemo, createSignal, For, Show, untrack } from "solid-js";
import { channelDisplayName, isPingingActivity, store } from "../../../lib/store";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";
import "./ActivityRow.css";
import "./ActivityThread.css";
import {
  formatTime,
  ThreadActivityMessage,
  ThreadBundleMessage,
  ThreadRootMessage,
} from "./activityThreadMessage";

export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
}

export function rowTarget(row: ActivityRow) {
  const [latest] = row.items;
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

// Reaction/mention items on a plain channel message aren't a thread at all —
// open them in the channel, scrolled to the real message, instead of a
// single-message thread panel that reads as a fake thread. Only actual
// thread replies (which don't render inline in the channel) open the
// thread panel, highlighted on the specific reply.
function navigateToItem(item: ActivityItem) {
  if (item.threadTs) {
    store.viewState.openChannelPeek(item.channelId, item.threadTs, item.ts);
  } else {
    store.viewState.openChannelMessage(item.channelId, item.ts);
  }
}

function verbFor(item: ActivityItem): string {
  switch (item.kind) {
    case "mention":
      return "Mentioned you";
    case "dm":
      return "Sent you a message";
    case "keyword":
      return item.matchedKeyword ? `Said “${item.matchedKeyword}”` : "Used a pingword";
    case "thread_reply":
      return "Replied in a thread";
    case "channel_mention":
      return `Mentioned @${item.broadcastRange ?? "channel"}`;
    case "usergroup_mention":
      return "Mentioned your usergroup";
    case "channel_all":
      return "Posted in a channel you follow";
    default:
      return "Reacted to your message";
  }
}

export default function ActivityRow(props: {
  row: ActivityRow;
  onReacted: (items: readonly ActivityItem[]) => void;
  onSeen: (items: readonly ActivityItem[]) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const latest = createMemo(() => props.row.items[0]);
  const user = createMemo(() => store.users.userById(latest().userId));
  const channel = createMemo(() => store.channels.channelById(latest().channelId));
  const isUnread = createMemo(() => store.activity.isActivityItemUnread(latest()));
  const isReacted = createMemo(() => store.activity.isActivityItemReacted(latest()));
  const isPinging = createMemo(() => isPingingActivity(latest()));
  const isThreadGroup = createMemo(() => props.row.isThread && props.row.items.length > 1);
  const orderedItems = createMemo(() => [...props.row.items].reverse());
  // Frozen at first read (untrack) so items don't collapse out from under the
  // user mid-view once markActivityItemsRead fires; a genuinely new reply
  // still surfaces because it changes props.row.items itself.
  const visibleStartIndex = createMemo(() => {
    const items = orderedItems();
    return untrack(() => {
      const idx = items.findIndex((item) => store.activity.isActivityItemUnread(item));
      return idx === -1 ? items.length - 1 : idx;
    });
  });
  const olderItems = createMemo(() => orderedItems().slice(0, visibleStartIndex()));
  const visibleItems = createMemo(() => orderedItems().slice(visibleStartIndex()));
  const threadTs = createMemo(() => latest().threadTs ?? rowTarget(props.row).ts);
  const rootMessage = createMemo(() =>
    store.messages.messagesByChannel[latest().channelId]?.find(
      (message) => message.ts === threadTs(),
    ),
  );
  const hasSeparateRoot = createMemo(() => {
    const root = rootMessage();
    return !!root && !props.row.items.some((item) => item.ts === root.ts);
  });
  const hiddenMessageCount = createMemo(() => olderItems().length + (hasSeparateRoot() ? 1 : 0));

  // Slack bundles an entire burst of unread thread replies into a single
  // feed entry — only its latest ts is exposed, so this one ActivityItem can
  // stand in for many actual messages. Fetch the real replies so all of them
  // can be shown instead of just the one.
  const bundledItem = createMemo(() =>
    props.row.items.find((item) => item.kind === "thread_reply" && (item.unreadCount ?? 0) > 1),
  );
  const bundleMessages = createMemo(() => {
    const bundled = bundledItem();
    if (!bundled) return;
    const list = store.messages.threadMessages[threadTs()];
    if (!list) return;
    return list.slice(-Math.min(bundled.unreadCount ?? 1, list.length));
  });
  const replierIds = createMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of props.row.items) {
      if (seen.has(item.userId)) continue;
      seen.add(item.userId);
      ids.push(item.userId);
    }
    return ids;
  });

  const formatInteractorNames = (ids: string[]) => {
    const names = ids.map((id) =>
      id === store.users.currentUser()?.id ? "you" : (store.users.userById(id)?.name ?? "someone"),
    );
    return names.reduce(
      (previous, current, index, all) =>
        (previous ? previous + (index < all.length - 1 ? ", " : " and ") : "") + current,
      "",
    );
  };

  const openRow = () => {
    props.onSeen(props.row.items);
    navigateToItem(latest());
  };

  const openMessage = (item: ActivityItem) => {
    props.onSeen(props.row.items);
    navigateToItem(item);
  };

  const openThreadTs = (ts: string) => {
    props.onSeen(props.row.items);
    store.viewState.openChannelPeek(latest().channelId, threadTs(), ts);
  };

  return (
    <article class="activity-item-wrap">
      <div
        class="activity-item"
        classList={{
          "activity-item-thread": isThreadGroup(),
          pinging: isPinging(),
          reacted: isReacted(),
          unread: isUnread(),
        }}
      >
        <button class="activity-item-summary btn-reset" onClick={openRow} type="button">
          <span class="activity-item-avatar">
            <Show
              fallback={
                <Show when={user()}>
                  {(person) => (
                    <Avatar
                      size="small"
                      user={{ ...person(), avatarColor: person().avatarColor ?? "#616061" }}
                    />
                  )}
                </Show>
              }
              when={isThreadGroup()}
            >
              <Tooltip content={formatInteractorNames(replierIds())}>
                <AvatarStack
                  users={replierIds()
                    .slice(0, 3)
                    .map((id) => store.users.userById(id))
                    .filter((person) => person !== undefined)}
                />
              </Tooltip>
            </Show>
          </span>
          <span class="activity-body">
            <span class="activity-headline">
              <Tooltip content={verbFor(latest())}>
                <Icon
                  class="activity-kind-icon"
                  name={ACTIVITY_KIND_ICONS[latest().kind]}
                  size={12}
                />
              </Tooltip>
              <Show fallback={<strong>{user()?.name ?? "Someone"}</strong>} when={isThreadGroup()}>
                <strong>{formatInteractorNames(replierIds())}</strong>
              </Show>
              <Show when={latest().kind !== "dm"}>
                <span class="activity-channel">
                  #{channelDisplayName(channel(), latest().channelId)}
                </span>
              </Show>
              <Show when={isThreadGroup()}>
                <span class="activity-reply-count">{props.row.items.length}</span>
              </Show>
              <Show when={latest().kind === "reaction" && latest().reactionName}>
                <span class="activity-reaction">
                  <EmojiText text={`:${latest().reactionName}:`} />
                </span>
              </Show>
              <Show when={isReacted()}>
                <span class="activity-reacted-label">
                  <Icon name="check" size={11} /> Reacted
                </span>
              </Show>
              <span class="activity-time">{formatTime(latest().time)}</span>
            </span>
            <Show when={!isThreadGroup()}>
              <span class="activity-snippet">
                <Mrkdwn text={latest().text} />
              </span>
            </Show>
          </span>
        </button>

        <Show when={isThreadGroup()}>
          <div class="activity-thread-timeline">
            <Show when={hiddenMessageCount() > 0 && !expanded()}>
              <button
                class="activity-read-more btn-reset"
                onClick={() => setExpanded(true)}
                type="button"
              >
                <Icon name="history" size={13} />
                Read {hiddenMessageCount()} earlier{" "}
                {hiddenMessageCount() === 1 ? "message" : "messages"}
              </button>
            </Show>
            <Show when={expanded() && hasSeparateRoot() ? rootMessage() : undefined}>
              {(root) => (
                <ThreadRootMessage message={root()} onOpen={() => openThreadTs(root().ts)} />
              )}
            </Show>
            <Show when={expanded()}>
              <For each={olderItems()}>
                {(item) => <ThreadActivityMessage item={item} onOpen={() => openMessage(item)} />}
              </For>
            </Show>
            <For each={visibleItems()}>
              {(item) => (
                <Show
                  fallback={<ThreadActivityMessage item={item} onOpen={() => openMessage(item)} />}
                  when={item === bundledItem() ? bundleMessages() : undefined}
                >
                  {(messages) => (
                    <For each={messages()}>
                      {(message) => (
                        <ThreadBundleMessage
                          message={message}
                          onOpen={() => openThreadTs(message.ts)}
                        />
                      )}
                    </For>
                  )}
                </Show>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Tooltip
        class="activity-react-toggle-anchor"
        content={isReacted() ? "Reacted" : "Move to Reacted"}
      >
        <button
          aria-label="Move to Reacted"
          class="activity-react-toggle btn-reset flex-center"
          classList={{ active: isReacted() }}
          onClick={() => props.onReacted(props.row.items)}
          type="button"
        >
          <Icon name={isReacted() ? "check-circle-filled" : "check-circle"} size={17} />
        </button>
      </Tooltip>
      <span class="activity-unread-dot" classList={{ unread: isUnread() }} />
    </article>
  );
}
