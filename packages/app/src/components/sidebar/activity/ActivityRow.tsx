import { formatTime } from "@slock/blockkit";
import type { ActivityItem, Message } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon, Tooltip } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import {
  conversationDisplayName,
  formatInteractorNames,
  isPingingActivity,
  store,
} from "../../../lib/store";
import ReactionRow from "../../messages/parts/ReactionRow";
import { ActivityRowActions } from "./ActivityRowActions";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";
import { activityVerb } from "./activityMetadata";
import "./ActivityRow.css";
import "./ActivityThread.css";
import { ActivityMessageText, ThreadMessageRow } from "./activityThreadMessage";

// A thread's unread tail renders in full below the summary, uncollapsed —
// fine for a handful of replies, not for a thread that's been unread for a
// week. Cap it so the feed stays scannable; the rest is one click away
// through the same "read N earlier" affordance as already-read history.
const MAX_INITIAL_TIMELINE_ENTRIES = 20;

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

export default function ActivityRow(props: {
  row: ActivityRow;
  onReacted: (items: readonly ActivityItem[]) => void;
  onSeen: (items: readonly ActivityItem[]) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const latest = createMemo(() => props.row.items[0]);
  const user = createMemo(() => store.users.userById(latest().userId));
  const channel = createMemo(() => store.channels.channelById(latest().channelId));
  const channelLabel = createMemo(() => {
    if (!latest().channelId) return "Activity";
    return conversationDisplayName(
      latest().channelId,
      channel(),
      store.dms.dmById(latest().channelId),
      store.users.userById,
    );
  });
  const isUnread = createMemo(() => store.activity.isActivityItemUnread(latest()));
  const isReacted = createMemo(() => store.activity.isActivityItemReacted(latest()));
  const isPinging = createMemo(() => isPingingActivity(latest()));
  const isListActivity = createMemo(() => latest().kind === "list");
  const isStandaloneActivity = createMemo(() => !latest().channelId);
  const showsActivityVerb = createMemo(() => isListActivity() || isStandaloneActivity());
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
    // Never your own reply — the fallbacks below only know position/timestamp.
    if (entryUserId(entry) === store.users.currentUser()?.id) return false;
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
  // still surfaces because it changes the timeline itself. Also caps how far
  // back an unread burst reaches on its own — a thread with hundreds of
  // unread replies would otherwise dump its entire tail straight into the
  // feed; past the cap it folds into the same "read N earlier" collapse as
  // already-read history.
  const visibleStartIndex = createMemo(() => {
    const entries = timeline();
    return untrack(() => {
      const idx = entries.findIndex(entryUnread);
      const firstUnread = idx === -1 ? entries.length - 1 : idx;
      return Math.max(firstUnread, entries.length - MAX_INITIAL_TIMELINE_ENTRIES);
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

  const interactorNames = (ids: string[]) =>
    formatInteractorNames(ids, store.users.currentUser()?.id, store.users.userById);

  const reactedMessage = createMemo(() =>
    latest().kind === "reaction"
      ? store.messages.reactionMessages[`${latest().channelId}:${latest().ts}`]?.[0]
      : undefined,
  );
  const matchingReaction = createMemo(() =>
    reactedMessage()?.reactions?.find((r) => r.name === latest().reactionName),
  );

  const openRow = () => {
    const item = latest();
    if (!item.channelId) return;
    props.onSeen(props.row.items);
    if (item.activityType === "quietly_added_to_channel") {
      store.viewState.setSelected({ id: item.channelId, kind: "channel" });
      return;
    }
    if (item.threadTs)
      store.viewState.openChannelPeek(item.channelId, item.threadTs, item.ts, { keepNav: true });
    else store.viewState.openChannelMessage(item.channelId, item.ts, { keepNav: true });
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
        <button
          class="activity-item-summary btn-reset"
          data-nav-row
          onClick={openRow}
          type="button"
        >
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
              <Tooltip content={interactorNames(replierIds())}>
                <AvatarStack
                  max={3}
                  users={replierIds()
                    .map((id) => store.users.userById(id))
                    .filter((person) => person !== undefined)}
                />
              </Tooltip>
            </Show>
          </span>
          <span class="activity-body">
            <span class="activity-headline">
              <Tooltip content={activityVerb(latest())}>
                <Icon
                  class="activity-kind-icon"
                  name={ACTIVITY_KIND_ICONS[latest().kind]}
                  size={12}
                />
              </Tooltip>
              <Show when={!(isThreadGroup() || isStandaloneActivity())}>
                <strong>{user()?.name ?? "Someone"}</strong>
              </Show>
              <Show when={showsActivityVerb()}>
                <span class="activity-channel">{activityVerb(latest())}</span>
              </Show>
              <Show when={latest().kind !== "dm" && !isStandaloneActivity()}>
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
                <ActivityMessageText text={latest().text} />
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
                data-nav-row
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

      <ActivityRowActions
        isReacted={isReacted()}
        isThread={isThreadGroup()}
        onReact={() => props.onReacted(props.row.items)}
        onUnsubscribe={() => store.messages.unsubscribeFromThread(latest().channelId, threadTs())}
        unsubscribePending={store.messages.isThreadSubscriptionPending(
          latest().channelId,
          threadTs(),
        )}
      />
      <span class="activity-unread-dot" classList={{ unread: isUnread() }} />
    </article>
  );
}
