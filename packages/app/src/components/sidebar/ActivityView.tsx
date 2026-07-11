import { EmojiText, Mrkdwn } from "@slock/blockkit";
import type { ActivityItem } from "@slock/slack-api";
import { Avatar, AvatarStack } from "@slock/ui";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import {
  activityItems,
  channelById,
  channelDisplayName,
  currentUser,
  ensureActivityLoaded,
  isActivityItemUnread,
  isPingingActivity,
  markActivityItemRead,
  markActivityRead,
  openChannelPeek,
  userById,
} from "../../lib/store";
import "./ActivityView.css";

type Tag = ActivityItem["kind"] | "app";
type ReadState = "all" | "unread" | "read";
type PingFilter = "all" | "pinging" | "ambient";

interface ActivityRow {
  key: string;
  items: ActivityItem[];
  isThread: boolean;
}

const TAG_FILTERS: { key: Tag; label: string }[] = [
  { key: "mention", label: "Mentions" },
  { key: "dm", label: "Direct messages" },
  { key: "keyword", label: "Pingwords" },
  { key: "thread_reply", label: "Threads" },
  { key: "channel_mention", label: "@channel & @here" },
  { key: "usergroup_mention", label: "Usergroups" },
  { key: "channel_all", label: "Channels set to notify on all messages" },
  { key: "reaction", label: "Reactions" },
  { key: "app", label: "Apps" },
];

const READ_STATES: { key: ReadState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

// "Pinging" mirrors the sidebar bell's own definition (direct @mention, DM,
// or a pingword) — everything else here is activity that's relevant but
// wasn't personally addressed at you (a thread you're in, an @channel/@here/
// usergroup broadcast, a channel set to notify on every post, or a reaction),
// the way a real notification-vs-ambient split works.
const PING_FILTERS: { key: PingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pinging", label: "Pinged you" },
  { key: "ambient", label: "Other" },
];

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

function rowTarget(row: ActivityRow) {
  const latest = row.items[0];
  return { channelId: latest.channelId, ts: latest.threadTs ?? latest.ts };
}

function ActivityRowView(props: {
  row: ActivityRow;
  onOpen: (channelId: string, ts: string) => void;
  onMarkRead: (channelId: string, ts: string) => void;
}) {
  const latest = createMemo(() => props.row.items[0]);
  const user = createMemo(() => userById(latest().userId));
  const channel = createMemo(() => channelById(latest().channelId));
  const isUnread = createMemo(() => props.row.items.some(isActivityItemUnread));
  const isPinging = createMemo(() => isPingingActivity(latest()));
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

  const markRead = (e: MouseEvent) => {
    e.stopPropagation();
    props.onMarkRead(latest().channelId, latest().ts);
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
          </div>
          <div class="activity-snippet">
            <Mrkdwn text={latest().text} />
          </div>
          <div class="activity-time">
            {new Date(latest().time).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
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

export default function ActivityView() {
  const [selectedTags, setSelectedTags] = createSignal<Set<Tag>>(new Set());
  const [keyword, setKeyword] = createSignal("");
  const [readState, setReadState] = createSignal<ReadState>("all");
  const [pingFilter, setPingFilter] = createSignal<PingFilter>("all");

  onMount(() => ensureActivityLoaded());

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filteredItems = createMemo(() => {
    const sorted = [...activityItems].sort((a, b) => b.time - a.time);
    const tags = selectedTags();
    const kw = keyword().trim().toLowerCase();
    const read = readState();
    const ping = pingFilter();

    return sorted.filter((item) => {
      if (tags.size > 0) {
        const itemTags: Tag[] = [item.kind];
        if (userById(item.userId)?.isBot) itemTags.push("app");
        if (!itemTags.some((t) => tags.has(t))) return false;
      }
      if (kw && !item.text.toLowerCase().includes(kw)) return false;
      const unread = isActivityItemUnread(item);
      if (read === "unread" && !unread) return false;
      if (read === "read" && unread) return false;
      const pinging = isPingingActivity(item);
      if (ping === "pinging" && !pinging) return false;
      if (ping === "ambient" && pinging) return false;
      return true;
    });
  });

  // Consecutive replies to the same thread collapse into a single row (keyed
  // at the position of their most recent reply) so a busy thread reads like a
  // thread instead of a wall of near-identical "replied in #x" lines.
  const rows = createMemo<ActivityRow[]>(() => {
    const groups = new Map<string, ActivityRow>();
    const ordered: ActivityRow[] = [];
    for (const item of filteredItems()) {
      if (item.kind === "thread_reply") {
        const key = `thread:${item.channelId}:${item.threadTs ?? item.ts}`;
        let row = groups.get(key);
        if (!row) {
          row = { key, items: [], isThread: true };
          groups.set(key, row);
          ordered.push(row);
        }
        row.items.push(item);
      } else {
        ordered.push({ key: `single:${item.id}`, items: [item], isThread: false });
      }
    }
    return ordered;
  });

  const unreadRows = createMemo(() => rows().filter((r) => r.items.some(isActivityItemUnread)));

  const goTo = (channelId: string, ts: string) => openChannelPeek(channelId, ts);

  const markRowRead = (channelId: string, ts: string) => markActivityItemRead(channelId, ts);

  // Triage flow: mark the topmost unread row read, then jump straight to
  // whatever is now next in the unread queue so you can blast through activity.
  const readAndNext = () => {
    const current = unreadRows()[0];
    if (!current) return;
    const target = rowTarget(current);
    markActivityItemRead(target.channelId, current.items[0].ts);
    const next = unreadRows()[0];
    if (next) goTo(rowTarget(next).channelId, rowTarget(next).ts);
  };

  return (
    <div class="activity-view">
      <div class="activity-view-header">
        <h2>Activity</h2>
        <div class="activity-header-actions">
          <button
            type="button"
            class="activity-read-next"
            disabled={unreadRows().length === 0}
            onClick={readAndNext}
          >
            Read &amp; next
            <Show when={unreadRows().length > 0}>
              <span class="activity-read-next-count">{unreadRows().length}</span>
            </Show>
          </button>
          <button type="button" class="activity-mark-read" onClick={markActivityRead}>
            Mark all as read
          </button>
        </div>
      </div>

      <div class="activity-toolbar">
        <input
          class="activity-search"
          type="text"
          placeholder="Filter by keyword"
          value={keyword()}
          onInput={(e) => setKeyword(e.currentTarget.value)}
        />

        <div class="activity-read-toggle">
          <For each={READ_STATES}>
            {(r) => (
              <button
                type="button"
                classList={{ active: readState() === r.key }}
                onClick={() => setReadState(r.key)}
              >
                {r.label}
              </button>
            )}
          </For>
        </div>

        <div class="activity-read-toggle">
          <For each={PING_FILTERS}>
            {(p) => (
              <button
                type="button"
                classList={{ active: pingFilter() === p.key }}
                onClick={() => setPingFilter(p.key)}
              >
                {p.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="activity-tag-filters">
        <For each={TAG_FILTERS}>
          {(f) => (
            <button
              type="button"
              class="activity-tag-chip"
              classList={{ active: selectedTags().has(f.key) }}
              onClick={() => toggleTag(f.key)}
            >
              {f.label}
            </button>
          )}
        </For>
        <Show when={selectedTags().size > 0}>
          <button
            type="button"
            class="activity-tag-clear"
            onClick={() => setSelectedTags(new Set())}
          >
            Clear
          </button>
        </Show>
      </div>

      <Show when={rows().length > 0} fallback={<div class="activity-empty">Nothing here yet.</div>}>
        <For each={rows()}>
          {(row) => <ActivityRowView row={row} onOpen={goTo} onMarkRead={markRowRead} />}
        </For>
      </Show>
    </div>
  );
}
