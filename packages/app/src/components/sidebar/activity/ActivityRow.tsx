import { EmojiText, formatTime } from "@slock/blockkit";
import {
  Avatar,
  AvatarStack,
  ClickableInline,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  Icon,
  openContextMenuFromKeyboard,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { type ActivityItem, type Block, formatDayFromMs, type Message } from "../../../lib/api";
import { store } from "../../../lib/store";
import MessageActionsMenuItems from "../../messages/parts/MessageActionsMenuItems";
import {
  type MessageAuthorFields,
  resolveProfileUserId,
} from "../../messages/parts/messageRenderState";
import ReactionRow from "../../messages/parts/ReactionRow";
import {
  openConversation,
  openConversationInSplit,
  SplitNavigation,
} from "../../navigation/SplitNavigation";
import ClickableAuthorName from "../../user/ClickableAuthorName";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";
import { activityVerb } from "./activityMetadata";
import "./ActivityRow.css";
import { ActivityRowActions } from "./ActivityRowActions";
import ActivityRowMenuItems from "./ActivityRowMenuItems";
import "./ActivityThread.css";
import { createActivityRowDisplay } from "./activityRowDisplay";
import { ActivityMessageText, ThreadMessageRow } from "./activityThreadMessage";
import { createActivityTimeline, type TimelineEntry } from "./activityTimeline";

export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
}

export function rowTarget(row: ActivityRow) {
  const [latest] = row.items;
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

function TimelineRow(props: {
  author: MessageAuthorFields;
  blocks?: Block[];
  channelId: string;
  isFirst: boolean;
  isLast: boolean;
  isRoot: boolean;
  message?: Message;
  onOpen: () => void;
  text: string;
  threadTs: string;
  ts: string;
  unread: boolean;
}) {
  const ctxMenu = useContextMenu();
  return (
    <>
      <ThreadMessageRow
        author={props.author}
        blocks={props.blocks}
        eventLabel={props.isRoot ? "started the thread" : undefined}
        isFirst={props.isFirst}
        isLast={props.isLast}
        isRoot={props.isRoot}
        onContextMenu={props.message ? ctxMenu.open : undefined}
        onOpen={props.onOpen}
        text={props.text}
        time={parseFloat(props.ts) * 1000}
        unread={props.unread}
      />
      <Show when={props.message}>
        {(message) => (
          <ContextMenu
            onClose={ctxMenu.close}
            open={ctxMenu.isOpen()}
            x={ctxMenu.x()}
            y={ctxMenu.y()}
          >
            <MessageActionsMenuItems
              channelId={props.channelId}
              msg={message()}
              onClose={ctxMenu.close}
              onEditRequest={props.onOpen}
              threadTs={props.threadTs}
            />
          </ContextMenu>
        )}
      </Show>
    </>
  );
}

export default function ActivityRow(props: {
  row: ActivityRow;
  onSeen: (items: readonly ActivityItem[]) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const ctxMenu = useContextMenu();
  const latest = createMemo(() => props.row.items[0]);
  const isThreadGroup = createMemo(() => props.row.isThread);
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

  const {
    avatarUrl,
    channelLabel,
    displayName,
    hasAnyActor,
    interactorNames,
    isPinging,
    isReacted,
    isStandaloneActivity,
    isUnread,
    matchingReaction,
    reactedMessage,
    replierIds,
    showsActivityVerb,
    user,
  } = createActivityRowDisplay({ items: () => props.row.items, latest });
  const profileUserId = createMemo(() => resolveProfileUserId(latest()));

  const {
    earlierMessageCount,
    entryAuthor,
    entryBlocks,
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
    props.onSeen(props.row.items);
    if (item.activityType === "quietly_added_to_channel") {
      store.viewState.setActiveView({ id: item.channelId, kind: "channel" });
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

  const openRowInSplit = () => {
    const item = latest();
    if (!item.channelId) return;
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
      <TimelineRow
        author={entryAuthor(entry)}
        blocks={entryBlocks(entry)}
        channelId={latest().channelId}
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
          pinging: isPinging(),
          reacted: isReacted(),
          unread: isUnread(),
        }}
      >
        <SplitNavigation onSplit={openRowInSplit}>
          <button
            class="activity-item-summary btn-reset"
            data-nav-row
            onClick={openRow}
            onContextMenu={ctxMenu.open}
            onKeyDown={(e) => openContextMenuFromKeyboard(e, ctxMenu.openAt)}
            tabIndex={-1}
            type="button"
          >
            <span class="activity-item-avatar">
              <Show
                fallback={
                  <Show
                    fallback={
                      <span class="activity-item-avatar-icon">
                        <Icon
                          name={
                            latest().activityType === "saved_reminder"
                              ? "reminder"
                              : ACTIVITY_KIND_ICONS[latest().kind]
                          }
                          size={12}
                        />
                      </span>
                    }
                    when={hasAnyActor()}
                  >
                    <Avatar
                      size="small"
                      user={{
                        avatarColor: user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                        avatarUrl: avatarUrl(),
                        id: latest().userId,
                        name: displayName(),
                        presence: user()?.presence,
                      }}
                    />
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
                  <Show
                    fallback={
                      <Icon
                        class="activity-kind-icon"
                        name={ACTIVITY_KIND_ICONS[latest().kind]}
                        size={12}
                      />
                    }
                    when={latest().kind === "reaction" && latest().reactionName}
                  >
                    {(name) => (
                      <span class="activity-kind-icon activity-reaction-emoji">
                        <EmojiText text={`:${name()}:`} />
                      </span>
                    )}
                  </Show>
                </Tooltip>
                <Show when={!(isThreadGroup() || isStandaloneActivity())}>
                  <Show fallback={<strong>{displayName()}</strong>} when={profileUserId()}>
                    {(id) => (
                      <ClickableAuthorName userId={id()}>
                        <strong>{displayName()}</strong>
                      </ClickableAuthorName>
                    )}
                  </Show>
                </Show>
                <Show when={showsActivityVerb()}>
                  <span class="activity-channel">{activityVerb(latest())}</span>
                </Show>
                <Show when={latest().kind !== "dm" && !isStandaloneActivity()}>
                  <span class="activity-channel">
                    <ClickableInline onActivate={() => openConversation(latest().channelId)}>
                      {channelLabel()}
                    </ClickableInline>
                  </span>
                </Show>
                <Show when={props.row.items.length > 1}>
                  <span class="activity-reply-count">{props.row.items.length}</span>
                </Show>
                <Show when={isReacted()}>
                  <span class="activity-reacted-label">
                    <Icon name="check" size={11} /> Reacted
                  </span>
                </Show>
                <Tooltip
                  content={`${formatDayFromMs(latest().time)} at ${formatTime(latest().time)}`}
                >
                  <span class="activity-time">{formatTime(latest().time)}</span>
                </Tooltip>
              </span>
              <Show when={!isThreadGroup()}>
                <span class="activity-snippet">
                  <ActivityMessageText blocks={latest().blocks} text={latest().text} />
                </span>
              </Show>
            </span>
          </button>
        </SplitNavigation>

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
        isSaved={isSaved()}
        isThread={
          isThreadGroup() && !store.messages.isThreadUnsubscribed(latest().channelId, threadTs())
        }
        isUnread={isUnread()}
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
