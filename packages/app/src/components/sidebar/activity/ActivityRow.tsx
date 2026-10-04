import type { ActivityItem } from "@slock/types";
import { ContextMenu, Icon, useContextMenu } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { openConversationInSplit } from "../../../lib/navigation/conversationNav";
import { store } from "../../../lib/store";
import ReactionRow from "../../messages/parts/ReactionRow";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import "./ActivityRow.css";
import ActivityAvatar from "./ActivityAvatar";
import ActivityHeadline from "./ActivityHeadline";
import { ActivityRowActions } from "./ActivityRowActions";
import ActivityRowMenuItems from "./ActivityRowMenuItems";
import ActivityTimelineRow from "./ActivityTimelineRow";
import "./ActivityThread.css";
import { createActivityRowDisplay } from "./activityRowDisplay";
import { ActivityMessageText } from "./activityThreadMessage";
import { createActivityTimeline, type TimelineEntry } from "./activityTimeline";

const [currentRowKey, setCurrentRowKey] = createSignal<string>();

export const clearCurrentRow = () => setCurrentRowKey(undefined);

export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
}

export function rowTarget(row: ActivityRow) {
  const [latest] = row.items;
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

export default function ActivityRow(props: {
  row: ActivityRow;
  onSeen: (items: readonly ActivityItem[]) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const ctxMenu = useContextMenu();
  const latest = createMemo(() => props.row.items[0]);
  const isThreadGroup = () => props.row.isThread;
  const threadTs = createMemo(() => latest().threadTs ?? rowTarget(props.row).ts);
  const saveTarget = createMemo(() => rowTarget(props.row));
  const isSaved = createMemo(() =>
    store.later.isSavedForLater(saveTarget().channelId, saveTarget().ts),
  );
  const savePending = createMemo(
    () =>
      store.later.laterLoading() ||
      store.later.isSaveForLaterPending(saveTarget().channelId, saveTarget().ts),
  );

  const display = createActivityRowDisplay({ items: () => props.row.items, latest });
  const { isArchived, isPinging, isUnread, reactedMessage, reactions, replierIds } = display;
  const isReactionGroup = createMemo(() => latest().kind === "reaction" && replierIds().length > 1);

  const {
    earlierMessageCount,
    entryAuthor,
    entryFiles,
    entryText,
    entryUnread,
    firstTimelineTs,
    lastTimelineTs,
    olderEntries,
    visibleEntries,
  } = createActivityTimeline({
    currentUserId: () => store.users.currentUser()?.id,
    expanded,
    isThreadGroup,
    items: () => props.row.items,
    latest,
    threadTs,
  });

  const openRow = () => {
    const item = latest();
    if (!item.channelId) return;
    setCurrentRowKey(props.row.key);
    props.onSeen(props.row.items);
    if (item.activityType === "quietly_added_to_channel") {
      store.viewState.setActiveView({ id: item.channelId, kind: "channel" });
      return;
    }
    store.viewState.openChannelMessage(item.channelId, item.ts, item.threadTs);
  };

  const openThreadTs = (ts: string) => {
    props.onSeen(props.row.items);
    store.viewState.openChannelPeek(latest().channelId, threadTs(), ts);
  };

  const openRowInSplit = () => {
    const item = latest();
    if (!item.channelId) return;
    setCurrentRowKey(props.row.key);
    props.onSeen(props.row.items);
    if (item.threadTs)
      store.viewState.openThread(item.channelId, item.threadTs, item.ts, { pinned: true });
    else openConversationInSplit(item.channelId, item.ts);
  };

  const openThreadInSplit = (ts: string) => {
    props.onSeen(props.row.items);
    store.viewState.openThread(latest().channelId, threadTs(), ts, { pinned: true });
  };

  const renderEntry = (entry: TimelineEntry) => (
    <SplitNavigation onSplit={() => openThreadInSplit(entry.ts)}>
      <ActivityTimelineRow
        author={entryAuthor(entry)}
        channelId={latest().channelId}
        files={entryFiles(entry)}
        isFirst={entry.ts === firstTimelineTs()}
        isLast={entry.ts === lastTimelineTs()}
        isRoot={entry.isRoot}
        message={entry.message}
        onOpen={() => openThreadTs(entry.ts)}
        text={entryText(entry)}
        threadTs={threadTs()}
        ts={entry.ts}
        unread={entryUnread(entry)}
      />
    </SplitNavigation>
  );

  return (
    <article class="activity-item-wrap">
      <div
        class="activity-item"
        classList={{
          "activity-item-thread": isThreadGroup(),
          active: currentRowKey() === props.row.key,
          archived: isArchived(),
          pinging: isPinging(),
          unread: isUnread(),
        }}
      >
        <SplitNavigation onSplit={openRowInSplit}>
          <button
            class="activity-item-summary btn-reset"
            data-activity-row
            data-nav-row
            onClick={openRow}
            onContextMenu={ctxMenu.open}
            tabIndex={-1}
            type="button"
          >
            <ActivityAvatar
              display={display}
              grouped={isThreadGroup() || isReactionGroup()}
              latest={latest()}
            />
            <span class="activity-body">
              <ActivityHeadline
                count={props.row.items.length}
                display={display}
                isReactionGroup={isReactionGroup()}
                isThreadGroup={isThreadGroup()}
                latest={latest()}
              />
              <Show when={!isThreadGroup()}>
                <span class="activity-snippet">
                  <ActivityMessageText files={latest().files} text={latest().text} />
                </span>
              </Show>
            </span>
          </button>
        </SplitNavigation>

        <Show when={!isThreadGroup() && reactions().length > 0}>
          <SplitNavigation onSplit={openRowInSplit}>
            <div class="activity-reaction-slot" data-nav-row onClick={openRow}>
              <ReactionRow
                isPending={(name) =>
                  store.messages.isReactionPending(latest().channelId, latest().ts, name)
                }
                onToggle={(name) => {
                  const msg = reactedMessage();
                  if (msg) store.messages.reactToMessage(latest().channelId, msg, name);
                }}
                reactions={reactions()}
              />
            </div>
          </SplitNavigation>
        </Show>

        <Show when={isThreadGroup()}>
          <div class="activity-thread-timeline flex-col">
            <Show when={earlierMessageCount() > 0 && !expanded()}>
              <button
                class="activity-read-more btn-reset"
                data-nav-row
                onClick={() => setExpanded(true)}
                tabIndex={-1}
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
        isArchived={isArchived()}
        isSaved={isSaved()}
        isThread={
          isThreadGroup() && !store.messages.isThreadUnsubscribed(latest().channelId, threadTs())
        }
        isUnread={isUnread()}
        onArchive={() => store.activity.archiveActivity(latest())}
        onMarkRead={() => props.onSeen(props.row.items)}
        onToggleSave={() => store.later.toggleSaveForLater(saveTarget().channelId, saveTarget().ts)}
        onUnsubscribe={() => {
          store.messages.unsubscribeFromThread(latest().channelId, threadTs());
          props.onSeen(props.row.items);
        }}
        savePending={savePending()}
        unsubscribePending={store.messages.isThreadSubscriptionPending(
          latest().channelId,
          threadTs(),
        )}
      />
      <span class="activity-unread-dot" classList={{ unread: isUnread() }} />

      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <ActivityRowMenuItems onClose={ctxMenu.close} onSeen={props.onSeen} row={props.row} />
      </ContextMenu>
    </article>
  );
}
