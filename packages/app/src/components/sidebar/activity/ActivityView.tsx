import type { ActivityItem } from "@slock/slack-api";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { store } from "../../../lib/store";
import ActivityRow, { type ActivityRow as ActivityRowData, rowTarget } from "./ActivityRow";
import "./ActivityView.css";

type Tag = ActivityItem["kind"] | "app";
type ReadState = "all" | "unread" | "read";

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

export default function ActivityView() {
  const [selectedTags, setSelectedTags] = createSignal<Set<Tag>>(new Set());
  const [keyword, setKeyword] = createSignal("");
  const [readState, setReadState] = createSignal<ReadState>("all");

  onMount(() => store.activity.ensureActivityLoaded());

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filteredItems = createMemo(() => {
    const sorted = [...store.activity.activityItems].sort((a, b) => b.time - a.time);
    const tags = selectedTags();
    const kw = keyword().trim().toLowerCase();
    const read = readState();

    return sorted.filter((item) => {
      if (tags.size > 0) {
        const itemTags: Tag[] = [item.kind];
        if (store.users.userById(item.userId)?.isBot) itemTags.push("app");
        if (!itemTags.some((t) => tags.has(t))) return false;
      }
      if (kw && !item.text.toLowerCase().includes(kw)) return false;
      const unread = store.activity.isActivityItemUnread(item);
      if (read === "unread" && !unread) return false;
      if (read === "read" && unread) return false;
      return true;
    });
  });

  // Consecutive replies to the same thread collapse into a single row (keyed
  // at the position of their most recent reply) so a busy thread reads like a
  // thread instead of a wall of near-identical "replied in #x" lines.
  const rows = createMemo<ActivityRowData[]>(() => {
    const groups = new Map<string, ActivityRowData>();
    const ordered: ActivityRowData[] = [];
    for (const item of filteredItems()) {
      if (item.kind === "thread_reply") {
        const key = `thread:${item.channelId}:${item.threadTs ?? item.ts}`;
        let row = groups.get(key);
        if (!row) {
          row = { isThread: true, items: [], key };
          groups.set(key, row);
          ordered.push(row);
        }
        row.items.push(item);
      } else {
        ordered.push({ isThread: false, items: [item], key: `single:${item.id}` });
      }
    }
    return ordered;
  });

  const unreadRows = createMemo(() =>
    rows().filter((r) => r.items.some(store.activity.isActivityItemUnread)),
  );

  const goTo = (channelId: string, ts: string) => store.viewState.openChannelPeek(channelId, ts);

  const markRowRead = (channelId: string, ts: string) =>
    store.activity.markActivityItemRead(channelId, ts);

  // Scoped to whatever's currently filtered/visible, not every activity item
  // that's ever landed here — so "Mark all as read" while filtered to
  // "Reactions" doesn't also silently clear unread mentions out of view.
  const markVisibleAsRead = () => {
    for (const item of filteredItems())
      store.activity.markActivityItemRead(item.channelId, item.ts);
  };

  // Triage flow: mark the topmost unread row read, then jump straight to
  // whatever is now next in the unread queue so you can blast through activity.
  const readAndNext = () => {
    const current = unreadRows()[0];
    if (!current) return;
    const target = rowTarget(current);
    store.activity.markActivityItemRead(target.channelId, current.items[0].ts);
    const next = unreadRows()[0];
    if (next) goTo(rowTarget(next).channelId, rowTarget(next).ts);
  };

  return (
    <div class="activity-view sidebar-view-panel">
      <div class="activity-view-header flex-between">
        <h2>Activity</h2>
        <div class="activity-header-actions flex-align-center">
          <button
            class="activity-read-next btn-reset flex-align-center text-xs"
            disabled={unreadRows().length === 0}
            onClick={readAndNext}
            type="button"
          >
            Read &amp; next
            <Show when={unreadRows().length > 0}>
              <span class="activity-read-next-count">{unreadRows().length}</span>
            </Show>
          </button>
          <button
            class="activity-mark-read btn-reset chip"
            onClick={markVisibleAsRead}
            type="button"
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div class="activity-toolbar flex-align-center">
        <input
          class="activity-search"
          onInput={(e) => setKeyword(e.currentTarget.value)}
          placeholder="Filter by keyword"
          type="text"
          value={keyword()}
        />

        <div class="activity-read-toggle">
          <For each={READ_STATES}>
            {(r) => (
              <button
                class="btn-reset"
                classList={{ active: readState() === r.key }}
                onClick={() => setReadState(r.key)}
                type="button"
              >
                {r.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="activity-tag-filters flex-align-center">
        <For each={TAG_FILTERS}>
          {(f) => (
            <button
              class="activity-tag-chip btn-reset chip"
              classList={{ active: selectedTags().has(f.key) }}
              onClick={() => toggleTag(f.key)}
              type="button"
            >
              {f.label}
            </button>
          )}
        </For>
        <Show when={selectedTags().size > 0}>
          <button
            class="activity-tag-clear btn-reset link-action"
            onClick={() => setSelectedTags(new Set())}
            type="button"
          >
            Clear
          </button>
        </Show>
      </div>

      <Show
        fallback={<div class="activity-empty empty-state">Nothing here yet.</div>}
        when={rows().length > 0}
      >
        <For each={rows()}>
          {(row) => <ActivityRow onMarkRead={markRowRead} onOpen={goTo} row={row} />}
        </For>
      </Show>
    </div>
  );
}
