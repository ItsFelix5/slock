import { EmojiText, Mrkdwn } from "@slock/blockkit";
import type { ActivityItem, Message } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon, Tooltip } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { channelDisplayName, isPingingActivity, store } from "../../../lib/store";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";
import "./ActivityRow.css";
import "./ActivityThread.css";

export interface ActivityRow {
  isThread: boolean;
  items: ActivityItem[];
  key: string;
}

export function rowTarget(row: ActivityRow) {
  const [latest] = row.items;
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

function verbFor(item: ActivityItem): string {
  switch (item.kind) {
    case "mention":
      return "mentioned you";
    case "dm":
      return "sent you a message";
    case "keyword":
      return item.matchedKeyword ? `said “${item.matchedKeyword}”` : "used pingword";
    case "thread_reply":
      return "replied in";
    case "channel_mention":
      return `mentioned @${item.broadcastRange ?? "channel"} in`;
    case "usergroup_mention":
      return "mentioned usergroup";
    case "channel_all":
      return "posted in";
    default:
      return "reacted to your message in";
  }
}

function formatTime(time: number) {
  return new Date(time).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ThreadActivityMessage(props: { item: ActivityItem; onOpen: () => void }) {
  const user = createMemo(() => store.users.userById(props.item.userId));
  const unread = createMemo(() => store.activity.isActivityItemUnread(props.item));
  return (
    <button
      class="activity-thread-message btn-reset"
      classList={{ unread: unread() }}
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
          <Show when={props.item.kind === "reaction" && props.item.reactionName}>
            <span class="activity-thread-event">
              reacted <EmojiText text={`:${props.item.reactionName}:`} />
            </span>
          </Show>
          <span class="activity-thread-message-time">{formatTime(props.item.time)}</span>
        </span>
        <span class="activity-thread-message-text">
          <Mrkdwn text={props.item.text} />
        </span>
      </span>
    </button>
  );
}

function ThreadRootMessage(props: { message: Message; onOpen: () => void }) {
  const user = createMemo(() => store.users.userById(props.message.userId));
  return (
    <button
      class="activity-thread-message activity-thread-root btn-reset"
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
          <span class="activity-thread-event">started the thread</span>
        </span>
        <span class="activity-thread-message-text">
          <Mrkdwn text={props.message.text} />
        </span>
      </span>
    </button>
  );
}

export default function ActivityRow(props: {
  row: ActivityRow;
  onOpen: (channelId: string, ts: string) => void;
  onReacted: (items: readonly ActivityItem[]) => void;
  onSeen: (items: readonly ActivityItem[]) => void;
}) {
  const [expanded, setExpanded] = createSignal(false);
  let wrapRef: HTMLElement | undefined;
  let seenTimer: number | undefined;
  const latest = createMemo(() => props.row.items[0]);
  const user = createMemo(() => store.users.userById(latest().userId));
  const channel = createMemo(() => store.channels.channelById(latest().channelId));
  const isUnread = createMemo(() => store.activity.isActivityItemUnread(latest()));
  const isReacted = createMemo(() => store.activity.isActivityItemReacted(latest()));
  const isPinging = createMemo(() => isPingingActivity(latest()));
  const isThreadGroup = createMemo(() => props.row.isThread && props.row.items.length > 1);
  const orderedItems = createMemo(() => [...props.row.items].reverse());
  const olderItems = createMemo(() => orderedItems().slice(0, -1));
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
    props.onOpen(latest().channelId, rowTarget(props.row).ts);
  };

  onMount(() => {
    if (!wrapRef) return;
    if (typeof IntersectionObserver === "undefined") {
      props.onSeen(props.row.items);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          seenTimer = window.setTimeout(() => props.onSeen(props.row.items), 500);
        } else if (seenTimer !== undefined) {
          window.clearTimeout(seenTimer);
          seenTimer = undefined;
        }
      },
      { root: wrapRef.closest(".activity-view"), threshold: 0.25 },
    );
    observer.observe(wrapRef);
    onCleanup(() => {
      observer.disconnect();
      if (seenTimer !== undefined) window.clearTimeout(seenTimer);
    });
  });

  return (
    <article class="activity-item-wrap" ref={(element) => (wrapRef = element)}>
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
              {(root) => <ThreadRootMessage message={root()} onOpen={openRow} />}
            </Show>
            <Show when={expanded()}>
              <For each={olderItems()}>
                {(item) => <ThreadActivityMessage item={item} onOpen={openRow} />}
              </For>
            </Show>
            <ThreadActivityMessage item={latest()} onOpen={openRow} />
          </div>
        </Show>
      </div>

      <Tooltip content={isReacted() ? "Reacted" : "Move to Reacted"}>
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
