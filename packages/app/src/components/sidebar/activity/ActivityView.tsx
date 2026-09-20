import { Button, Icon, initRovingTabIndexDefault } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import { formatDayFromMs } from "../../../lib/api";
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
  TAG_FILTERS,
  type Tag,
} from "./activityViewFilters";

const NEAR_BOTTOM_VIEWPORT_FRACTION = 1.5;

const MAX_AUTO_TOP_UP_ATTEMPTS = 25;

function sameItems(a: ActivityRowData["items"], b: ActivityRowData["items"]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item === b[i]);
}

export default function ActivityView() {
  let listRef: HTMLDivElement | undefined;
  const [selectedTag, setSelectedTag] = createSignal<Tag | "all">("all");
  const [readState, setReadState] = createSignal<ReadState>("all");

  createEffect(() => {
    const currentUser = store.users.currentUser();
    const preferencesSettled =
      store.preferences.preferencesReady() || !!store.resources.userPrefs.error;
    if (currentUser && preferencesSettled)
      void untrack(() => store.activity.ensureActivityLoaded());
  });

  let rowsCache = new Map<string, ActivityRowData>();
  const rows = createMemo<ActivityRowData[]>(() => {
    const buckets = new Map<string, ActivityRowData["items"]>();
    const order: string[] = [];
    const items = [...store.activity.activityItems].sort((a, b) => b.time - a.time);
    for (const item of items) {
      const threadTs = item.kind === "thread_reply" ? (item.threadTs ?? item.ts) : undefined;
      const key = threadTs ? `thread:${item.channelId}:${threadTs}` : `single:${item.id}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
        order.push(key);
      }
      bucket.push(item);
    }
    const nextCache = new Map<string, ActivityRowData>();
    const ordered = order.map((key) => {
      const bucketItems = buckets.get(key)!;
      const cached = rowsCache.get(key);
      const row =
        cached && sameItems(cached.items, bucketItems)
          ? cached
          : { isThread: key.startsWith("thread:"), items: bucketItems, key };
      nextCache.set(key, row);
      return row;
    });
    rowsCache = nextCache;
    return ordered;
  });

  const statusFor = (row: ActivityRowData): RowStatus => {
    const latest = latestItem(row);
    if (store.activity.isActivityItemArchived(latest)) return "archived";
    if (store.activity.activityItemReadState(latest) === "pending") return "pending";
    if (store.activity.isActivityItemUnread(latest)) return "unread";
    return "read";
  };

  const tagRows = createMemo(() => {
    const tag = selectedTag();
    if (tag === "all") return rows();
    return rows().filter((row) => row.items.some((item) => item.kind === tag));
  });

  const rowsWithStatus = createMemo(() =>
    tagRows().map((row) => ({ row, status: statusFor(row) })),
  );

  const statusCounts = createMemo(() => {
    const counts: Record<Exclude<ReadState, "all">, number> = {
      archived: 0,
      read: 0,
      unread: 0,
    };
    for (const { status } of rowsWithStatus()) {
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
    if (key === "all")
      return generalScopeExhausted() ? tagRows().length - statusCounts().archived : undefined;
    if (key === "unread") return unreadScopeExhausted() ? statusCounts().unread : undefined;
    return generalScopeExhausted() ? statusCounts()[key] : undefined;
  };

  const visibleRows = createMemo(() => {
    const state = readState();
    const entries =
      state === "all"
        ? rowsWithStatus().filter(({ status }) => status !== "archived")
        : rowsWithStatus().filter(({ status }) => status === state);
    return entries.map(({ row }) => row);
  });

  let entriesCache = new Map<string, ActivityListEntry>();
  const groupedVisibleRows = createMemo<ActivityListEntry[]>(() => {
    const nextCache = new Map<string, ActivityListEntry>();
    const entries: ActivityListEntry[] = [];
    let lastDay: string | undefined;
    for (const row of visibleRows()) {
      const day = formatDayFromMs(latestItem(row).time);
      if (day !== lastDay) {
        const dividerKey = `divider:${day}`;
        const cached = entriesCache.get(dividerKey);
        const divider = cached?.kind === "divider" ? cached : { day, kind: "divider" as const };
        entries.push(divider);
        nextCache.set(dividerKey, divider);
        lastDay = day;
      }
      const cached = entriesCache.get(row.key);
      const entry =
        cached?.kind === "row" && cached.row === row
          ? cached
          : { key: row.key, kind: "row" as const, row };
      entries.push(entry);
      nextCache.set(row.key, entry);
    }
    entriesCache = nextCache;
    return entries;
  });

  initRovingTabIndexDefault(() => listRef, groupedVisibleRows);

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
    const key = `${selectedTag()}|${readState()}`;
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
          <div class="activity-list" ref={listRef}>
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
