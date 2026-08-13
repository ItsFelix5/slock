import { formatDayFromMs } from "@slock/slack-api";
import { Button, Icon } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import { store } from "../../../lib/store";
import ActivityRow, { type ActivityRow as ActivityRowData } from "./ActivityRow";
import ActivityToolbar from "./ActivityToolbar";
import "./ActivityView.css";
import {
  type ActivityListEntry,
  feedTypesForTag,
  latestItem,
  type ReadState,
  type RowStatus,
  type Tag,
  TAG_FILTERS,
} from "./activityViewFilters";

const NEAR_BOTTOM_VIEWPORT_FRACTION = 1.5;

const MAX_AUTO_TOP_UP_ATTEMPTS = 25;

export default function ActivityView() {
  const [selectedTag, setSelectedTag] = createSignal<Tag | "all">("all");
  const [keyword, setKeyword] = createSignal("");
  const [readState, setReadState] = createSignal<ReadState>("all");

  createEffect(() => {
    const currentUser = store.users.currentUser();
    const preferencesSettled =
      store.preferences.preferencesReady() || !!store.resources.userPrefs.error;
    if (currentUser && preferencesSettled)
      void untrack(() => store.activity.ensureActivityLoaded());
  });

  const rows = createMemo<ActivityRowData[]>(() => {
    const groups = new Map<string, ActivityRowData>();
    const ordered: ActivityRowData[] = [];
    const items = [...store.activity.activityItems].sort((a, b) => b.time - a.time);
    for (const item of items) {
      const threadTs =
        item.kind === "reaction"
          ? undefined
          : (item.threadTs ?? (item.kind === "thread_reply" ? item.ts : undefined));
      if (!threadTs) {
        ordered.push({ isThread: false, items: [item], key: `single:${item.id}` });
        continue;
      }
      const key = `thread:${item.channelId}:${threadTs}`;
      let row = groups.get(key);
      if (!row) {
        row = { isThread: true, items: [], key };
        groups.set(key, row);
        ordered.push(row);
      }
      row.items.push(item);
    }
    return ordered;
  });

  const statusFor = (row: ActivityRowData): RowStatus => {
    const latest = latestItem(row);
    if (store.activity.isActivityItemReacted(latest)) return "reacted";
    if (store.activity.activityItemReadState(latest) === "pending") return "pending";
    if (store.activity.isActivityItemUnread(latest)) return "unread";
    return "read";
  };

  const tagAndSearchRows = createMemo(() => {
    const tag = selectedTag();
    const query = keyword().trim().toLowerCase();
    return rows().filter((row) => {
      if (tag !== "all") {
        const matches = row.items.some((item) => item.kind === tag);
        if (!matches) return false;
      }
      return !query || row.items.some((item) => item.text.toLowerCase().includes(query));
    });
  });

  const statusCounts = createMemo(() => {
    const counts: Record<Exclude<ReadState, "all">, number> = {
      reacted: 0,
      read: 0,
      unread: 0,
    };
    for (const row of tagAndSearchRows()) {
      const status = statusFor(row);
      if (status !== "pending") counts[status] += 1;
    }
    return counts;
  });

  const generalScopeExhausted = createMemo(
    () => !store.activity.activityHasMore(feedTypesForTag(selectedTag())),
  );
  const unreadScopeExhausted = createMemo(
    () =>
      generalScopeExhausted() ||
      !store.activity.activityHasMore(feedTypesForTag(selectedTag()), true),
  );
  const tabCount = (key: ReadState): number | undefined => {
    if (key === "all") return generalScopeExhausted() ? tagAndSearchRows().length : undefined;
    if (key === "unread") return unreadScopeExhausted() ? statusCounts().unread : undefined;
    return generalScopeExhausted() ? statusCounts()[key] : undefined;
  };

  const visibleRows = createMemo(() => {
    const state = readState();
    if (state === "all") return tagAndSearchRows();
    return tagAndSearchRows().filter((row) => statusFor(row) === state);
  });

  const groupedVisibleRows = createMemo<ActivityListEntry[]>(() => {
    const entries: ActivityListEntry[] = [];
    let lastDay: string | undefined;
    for (const row of visibleRows()) {
      const day = formatDayFromMs(latestItem(row).time);
      if (day !== lastDay) {
        entries.push({ day, kind: "divider" });
        lastDay = day;
      }
      entries.push({ key: row.key, kind: "row", row });
    }
    return entries;
  });

  const selectedTagLabel = createMemo(
    () => TAG_FILTERS.find((filter) => filter.key === selectedTag())?.label ?? "All activity",
  );

  const activeFeedTypes = createMemo(() => feedTypesForTag(selectedTag()));

  const activeUnreadOnly = createMemo(() => readState() === "unread");

  let scrollRef: HTMLDivElement | undefined;

  function handleScroll() {
    const el = scrollRef;
    if (
      !el ||
      el.scrollHeight - el.scrollTop - el.clientHeight >
        el.clientHeight * NEAR_BOTTOM_VIEWPORT_FRACTION
    )
      return;
    void store.activity.loadMoreActivity(activeFeedTypes(), activeUnreadOnly());
  }

  let topUpKey: string | undefined;
  let topUpAttempts = 0;
  createEffect(() => {
    visibleRows();
    const types = activeFeedTypes();
    const unreadOnly = activeUnreadOnly();
    const key = `${selectedTag()}|${readState()}|${keyword()}`;
    if (key !== topUpKey) {
      topUpKey = key;
      topUpAttempts = 0;
    }
    const el = scrollRef;
    if (!el || el.scrollHeight > el.clientHeight) return;
    if (!(store.activity.activityLoaded() && store.activity.activityHasMore(types, unreadOnly)))
      return;
    if (store.activity.activityLoading() || store.activity.activityLoadingMore()) return;
    if (topUpAttempts >= MAX_AUTO_TOP_UP_ATTEMPTS) return;
    topUpAttempts++;
    void store.activity.loadMoreActivity(types, unreadOnly);
  });

  return (
    <div
      aria-busy={store.activity.activityLoading()}
      class="activity-view"
      onScroll={handleScroll}
      ref={scrollRef}
    >
      <ActivityToolbar
        keyword={keyword()}
        onKeywordInput={setKeyword}
        onReadStateChange={setReadState}
        onSelectTag={setSelectedTag}
        readState={readState()}
        selectedTag={selectedTag()}
        tabCount={tabCount}
      />

      <Show
        when={
          !(store.activity.activityLoaded() || store.activity.activityLoadError()) &&
          rows().length === 0
        }
      >
        <div class="activity-load-state empty-state">Loading activity…</div>
      </Show>

      <Show when={store.activity.activityLoadError() && rows().length === 0}>
        <div class="activity-load-state activity-load-error empty-state">
          <span>Couldn't load activity.</span>
          <Button onClick={store.activity.ensureActivityLoaded} size="sm">
            Try again
          </Button>
        </div>
      </Show>

      <Show when={store.activity.activityLoadError() && rows().length > 0}>
        <div class="activity-load-notice activity-load-warning">
          <span>Couldn't refresh activity.</span>
          <Button onClick={store.activity.ensureActivityLoaded} size="sm">
            Try again
          </Button>
        </div>
      </Show>

      <Show when={store.activity.activityReadSyncError()}>
        <div class="activity-load-notice activity-load-warning">
          <span>Couldn't sync your read state.</span>
          <Button
            disabled={store.activity.activityReadSyncPending()}
            onClick={store.activity.retryActivityReadSync}
            size="sm"
          >
            {store.activity.activityReadSyncPending() ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </Show>

      <Show when={store.activity.activityLoaded() || rows().length > 0}>
        <Show
          fallback={
            <div class="activity-empty empty-state">
              <Icon name="check-circle" size={28} />
              <div>Nothing in {selectedTagLabel().toLowerCase()}.</div>
            </div>
          }
          when={visibleRows().length > 0}
        >
          <div class="activity-list">
            <For each={groupedVisibleRows()}>
              {(entry) =>
                entry.kind === "divider" ? (
                  <div class="activity-day-divider message-divider day-divider flex-align-center text-center font-bold text-xs">
                    <span>{entry.day}</span>
                  </div>
                ) : (
                  <ActivityRow onSeen={store.activity.markActivityItemsRead} row={entry.row} />
                )
              }
            </For>
          </div>

          <Show when={store.activity.activityLoadingMore()}>
            <div class="activity-load-notice text-dim text-sm">Loading more…</div>
          </Show>

          <Show when={store.activity.activityLoadMoreError()}>
            <div class="activity-load-notice activity-load-warning">
              <span>Couldn't load more activity.</span>
              <Button
                onClick={() =>
                  store.activity.loadMoreActivity(activeFeedTypes(), activeUnreadOnly())
                }
                size="sm"
              >
                Try again
              </Button>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
