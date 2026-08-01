import { Mrkdwn } from "@slock/blockkit";
import type { ActivityItem, Message } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon, Tooltip } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import { conversationDisplayName, isPingingActivity, store } from "../../../lib/store";
import ReactionRow from "../../messages/parts/ReactionRow";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";
import "./ActivityRow.css";
import "./ActivityThread.css";
import { formatTime, ThreadMessageRow } from "./activityThreadMessage";

export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
}

interface TimelineEntry {
  isRoot: boolean;
  item?: ActivityItem;
  message?: Message;
  ts: string;
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
    store.viewState.openChannelPeek(item.channelId, item.threadTs, item.ts, { keepNav: true });
  } else {
    store.viewState.openChannelMessage(item.channelId, item.ts, { keepNav: true });
  }
}

function TimelineRow(props: {
  isRoot: boolean;
  onOpen: () => void;
  text: string;
  ts: string;
  unread: boolean;
  userId: string;
}) {
  return (
    <ThreadMessageRow
      eventLabel={props.isRoot ? "started the thread" : undefined}
      isRoot={props.isRoot}
      onOpen={props.onOpen}
      text={props.text}
      time={parseFloat(props.ts) * 1000}
      unread={props.unread}
      userId={props.userId}
    />
  );
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
  const channel = createMemo(() => store.channels.knownChannelById(latest().channelId));
  const channelLabel = createMemo(() =>
    conversationDisplayName(
      latest().channelId,
      channel(),
      store.dms.dmById(latest().channelId),
      store.users.userById,
    ),
  );
  const isUnread = createMemo(() => store.activity.isActivityItemUnread(latest()));
  const isReacted = createMemo(() => store.activity.isActivityItemReacted(latest()));
  const isPinging = createMemo(() => isPingingActivity(latest()));
  const isThreadGroup = createMemo(() => props.row.isThread);
  const orderedItems = createMemo(() => [...props.row.items].reverse());
  const threadTs = createMemo(() => latest().threadTs ?? rowTarget(props.row).ts);

  // The channel's own message cache only covers whatever page of history is
  // currently loaded, which almost never includes an arbitrary thread's root
  // for a channel the user hasn't opened — fetch the real thread so nothing
  // between the root and the activity feed's own (sparse) entries silently
  // goes missing.
  createEffect(() => {
    if (!(isThreadGroup() && expanded())) return;
    store.messages.ensureThreadRepliesLoaded(latest().channelId, threadTs());
  });
  const fullThread = createMemo(() => store.messages.threadMessages[threadTs()]);
  const activityByTs = createMemo(() => {
    const map = new Map<string, ActivityItem>();
    for (const item of props.row.items) map.set(item.ts, item);
    return map;
  });

  // Slack bundles an entire burst of unread thread replies into a single
  // feed entry — only its latest ts is exposed, so this one ActivityItem can
  // stand in for many actual messages.
  const bundledItem = createMemo(() =>
    props.row.items.find((item) => item.kind === "thread_reply" && (item.unreadCount ?? 0) > 1),
  );

  // Structural only — no read/unread status baked in, so marking items read
  // elsewhere doesn't reshuffle which messages are already showing (see
  // visibleStartIndex below). Prefers the real fetched thread once it's in;
  // falls back to the (possibly sparse) activity items while that's loading.
  const timeline = createMemo<TimelineEntry[]>(() => {
    const list = fullThread();
    if (list && list.length > 0) {
      const byTs = activityByTs();
      return list.map((message) => ({
        isRoot: message.ts === threadTs(),
        item: byTs.get(message.ts),
        message,
        ts: message.ts,
      }));
    }
    return orderedItems().map((item) => ({ isRoot: false, item, ts: item.ts }));
  });

  function entryUnread(entry: TimelineEntry): boolean {
    if (entry.item) return store.activity.isActivityItemUnread(entry.item);
    const bundled = bundledItem();
    const list = fullThread();
    if (bundled?.unreadCount && list) {
      const tailStart = list.length - Math.min(bundled.unreadCount, list.length);
      const index = list.findIndex((message) => message.ts === entry.ts);
      if (index >= tailStart) return true;
    }
    // A reply the sparse activity feed never surfaced is still unread if it
    // sits past the channel's read cursor — otherwise it gets folded into the
    // collapsed "earlier messages" even though it was never read.
    const lastRead = store.unread.lastReadByChannel[latest().channelId] ?? 0;
    return parseFloat(entry.ts) * 1000 > lastRead;
  }

  function entryText(entry: TimelineEntry): string {
    return entry.message?.text ?? entry.item?.text ?? "";
  }

  function entryUserId(entry: TimelineEntry): string {
    return entry.message?.userId ?? entry.item?.userId ?? "";
  }

  // Frozen at first read (untrack) so items don't collapse out from under the
  // user mid-view once markActivityItemsRead fires; a genuinely new reply
  // still surfaces because it changes the timeline itself.
  const visibleStartIndex = createMemo(() => {
    const entries = timeline();
    return untrack(() => {
      const idx = entries.findIndex(entryUnread);
      return idx === -1 ? entries.length - 1 : idx;
    });
  });
  const olderEntries = createMemo(() => timeline().slice(0, visibleStartIndex()));
  const visibleEntries = createMemo(() => timeline().slice(visibleStartIndex()));
  const hiddenMessageCount = createMemo(() => olderEntries().length);
  const earlierMessageCount = createMemo(() =>
    Math.max(hiddenMessageCount(), (bundledItem()?.unreadCount ?? 1) - 1),
  );

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

  const reactedMessage = createMemo(() =>
    latest().kind === "reaction"
      ? store.messages.reactionMessages[`${latest().channelId}:${latest().ts}`]?.[0]
      : undefined,
  );
  const matchingReaction = createMemo(() =>
    reactedMessage()?.reactions?.find((r) => r.name === latest().reactionName),
  );

  const openRow = () => {
    props.onSeen(props.row.items);
    navigateToItem(latest());
  };

  const openThreadTs = (ts: string) => {
    props.onSeen(props.row.items);
    store.viewState.openChannelPeek(latest().channelId, threadTs(), ts, { keepNav: true });
  };

  const renderEntry = (entry: TimelineEntry) => (
    <TimelineRow
      isRoot={entry.isRoot}
      onOpen={() => openThreadTs(entry.ts)}
      text={entryText(entry)}
      ts={entry.ts}
      unread={entryUnread(entry)}
      userId={entryUserId(entry)}
    />
  );

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
              <Show when={!isThreadGroup()}>
                <strong>{user()?.name ?? "Someone"}</strong>
              </Show>
              <Show when={latest().kind !== "dm"}>
                <span class="activity-channel">{channelLabel()}</span>
              </Show>
              <Show when={props.row.items.length > 1}>
                <span class="activity-reply-count">{props.row.items.length}</span>
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

        {/* Its own reaction pills are separately clickable — kept outside the
        summary button above instead of nested inside it. */}
        <Show when={isThreadGroup() ? undefined : matchingReaction()}>
          {(reaction) => (
            <div class="activity-reaction-slot">
              <ReactionRow
                isPending={(name) =>
                  store.messages.isReactionPending(latest().channelId, latest().ts, name)
                }
                onToggle={(name) => {
                  const msg = reactedMessage();
                  if (msg) store.messages.reactToMessage(latest().channelId, msg, name);
                }}
                reactions={[reaction()]}
              />
            </div>
          )}
        </Show>

        <Show when={isThreadGroup()}>
          <div class="activity-thread-timeline">
            <Show when={earlierMessageCount() > 0 && !expanded()}>
              <button
                class="activity-read-more btn-reset"
                onClick={() => setExpanded(true)}
                type="button"
              >
                <Icon name="history" size={13} />
                Read {earlierMessageCount()} earlier{" "}
                {earlierMessageCount() === 1 ? "message" : "messages"}
              </button>
            </Show>
            <Show when={expanded()}>
              <For each={olderEntries()}>{renderEntry}</For>
            </Show>
            <For each={visibleEntries()}>{renderEntry}</For>
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
