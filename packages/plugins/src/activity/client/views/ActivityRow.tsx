import { maybeService, service } from "@slock/core/solid";
import type { ActivityItem } from "@slock/types";
import { ContextMenu, Icon, NavRow, useContextMenu } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { openConversationInSplit } from "../../../conversations/client/api/nav";
import ReactionRow from "../../../reactions/client/api/ReactionRow";
import { SplitNavigation } from "../../../shell/client/api/SplitNavigation";
import "./ActivityRow.css";
import ActivityAvatar from "./ActivityAvatar";
import ActivityHeadline from "./ActivityHeadline";
import { ActivityRowActions } from "./ActivityRowActions";
import ActivityRowMenuItems from "./ActivityRowMenuItems";
import ActivityTimelineRow from "./ActivityTimelineRow";
import "./ActivityThread.css";
import { defined } from "@slock/core";
import { createActivityRowDisplay } from "./activityRowDisplay";
import { ActivityMessageText } from "./activityThreadMessage";
import { createActivityTimeline, type TimelineEntry } from "./activityTimeline";

const viewStore = service("conversations");
const messageLinks = service("message-links");
const usersStore = service("users");
const messagesStore = service("messages");
const activityStore = service("activity");

const later = maybeService("later");

const [currentRowKey, setCurrentRowKey] = createSignal<string>();

export const clearCurrentRow = () => setCurrentRowKey(undefined);

export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
}

export function rowTarget(row: ActivityRow) {
  const latest = defined(row.items[0]);
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

export default function ActivityRow(props: {
  row: ActivityRow;
  onSeen: (items: readonly ActivityItem[]) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const ctxMenu = useContextMenu();
  const latest = createMemo(() => defined(props.row.items[0]));
  const isThreadGroup = () => props.row.isThread;
  const threadTs = createMemo(() => latest().threadTs ?? rowTarget(props.row).ts);
  const saveTarget = createMemo(() => rowTarget(props.row));
  const isSaved = createMemo(
    () => !!later()?.isSavedForLater(saveTarget().channelId, saveTarget().ts),
  );
  const savePending = createMemo(
    () =>
      !!later()?.laterLoading() ||
      !!later()?.isSaveForLaterPending(saveTarget().channelId, saveTarget().ts),
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
    currentUserId: () => usersStore.currentUser()?.id,
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
    if (item.activityType === "quietly_added_to_channel") {
      viewStore.setActiveView({ id: item.channelId, kind: "channel" });
      return;
    }
    messageLinks.openChannelMessage(item.channelId, item.ts, item.threadTs);
  };

  const openThreadTs = (ts: string) => {
    messageLinks.openChannelPeek(latest().channelId, threadTs(), ts);
  };

  const openRowInSplit = () => {
    const item = latest();
    if (!item.channelId) return;
    setCurrentRowKey(props.row.key);
    if (item.threadTs)
      messageLinks.openThread(item.channelId, item.threadTs, item.ts, { pinned: true });
    else openConversationInSplit(item.channelId, item.ts);
  };

  const openThreadInSplit = (ts: string) => {
    messageLinks.openThread(latest().channelId, threadTs(), ts, { pinned: true });
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
          pinging: isPinging(),
          unread: isUnread(),
        }}
      >
        <SplitNavigation onSplit={openRowInSplit}>
          <NavRow
            class="activity-item-summary"
            data-activity-row
            onActivate={openRow}
            onContextMenu={ctxMenu.open}
            tabIndex={-1}
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
          </NavRow>
        </SplitNavigation>

        <Show when={!isThreadGroup() && reactions().length > 0}>
          <SplitNavigation onSplit={openRowInSplit}>
            <div class="activity-reaction-slot" data-nav-row onClick={openRow}>
              <ReactionRow
                isPending={(name) =>
                  messagesStore.isReactionPending(latest().channelId, latest().ts, name)
                }
                onToggle={(name) => {
                  const msg = reactedMessage();
                  if (msg) messagesStore.reactToMessage(latest().channelId, msg, name);
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
          isThreadGroup() && !messagesStore.isThreadUnsubscribed(latest().channelId, threadTs())
        }
        isUnread={isUnread()}
        onArchive={() => activityStore.archiveActivity(latest())}
        onMarkRead={() => props.onSeen(props.row.items)}
        onToggleSave={
          later()
            ? () => later()?.toggleSaveForLater(saveTarget().channelId, saveTarget().ts)
            : undefined
        }
        onUnsubscribe={() => {
          messagesStore.unsubscribeFromThread(latest().channelId, threadTs());
          props.onSeen(props.row.items);
        }}
        savePending={savePending()}
        unsubscribePending={messagesStore.isThreadSubscriptionPending(
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
