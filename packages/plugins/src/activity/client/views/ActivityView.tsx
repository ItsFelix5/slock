import { formatDayFromMs } from "@slock/core";
import { service } from "@slock/core/solid";
import { Button, Icon, initRovingTabIndexDefault } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import ActivityRow, { type ActivityRow as ActivityRowData, clearCurrentRow } from "./ActivityRow";
import ActivityToolbar from "./ActivityToolbar";
import "./ActivityView.css";
import { createActivityRows } from "./activityRows";
import {
  type ActivityListEntry,
  feedTypesForTag,
  latestItem,
  type ReadState,
  type RowStatus,
  TAG_FILTERS,
  type Tag,
} from "./activityViewFilters";

const activityStore = service("activity");

const NEAR_BOTTOM_VIEWPORT_FRACTION = 1.5;
const MAX_AUTO_TOP_UP_ATTEMPTS = 25;

export default function ActivityView() {
  let listRef: HTMLDivElement | undefined;
  onCleanup(clearCurrentRow);
  const [selectedTag, setSelectedTag] = createSignal<Tag | "all">("all");
  const [readState, setReadState] = createSignal<ReadState>("all");

  const rows = createActivityRows();

  const statusFor = (row: ActivityRowData): RowStatus => {
    const latest = latestItem(row);
    if (activityStore.isActivityItemArchived(latest)) return "archived";
    if (activityStore.activityItemReadState(latest) === "pending") return "pending";
    if (activityStore.isActivityItemUnread(latest)) return "unread";
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
    () => !activityStore.activityHasMore(feedTypesForTag(selectedTag())),
  );
  const unreadScopeExhausted = createMemo(
    () =>
      generalScopeExhausted() ||
      !activityStore.activityHasMore(feedTypesForTag(selectedTag()), true),
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
    void activityStore.loadMoreActivity(activeFeedTypes(), activeUnreadOnly());
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
    if (!(activityStore.activityLoaded() && activityStore.activityHasMore(types, unreadOnly)))
      return;
    if (activityStore.activityLoading() || activityStore.activityLoadingMore()) return;
    if (topUpAttempts >= MAX_AUTO_TOP_UP_ATTEMPTS) return;
    topUpAttempts++;
    void activityStore.loadMoreActivity(types, unreadOnly);
  });

  return (
    <div
      aria-busy={activityStore.activityLoading()}
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
          !(activityStore.activityLoaded() || activityStore.activityLoadError()) &&
          rows().length === 0
        }
      >
        <div class="activity-load-state empty-state">Loading activity…</div>
      </Show>

      <Show when={activityStore.activityLoadError() && rows().length === 0}>
        <div class="activity-load-state activity-load-error empty-state">
          <span>Couldn't load activity.</span>
          <Button onClick={activityStore.ensureActivityLoaded} size="sm">
            Try again
          </Button>
        </div>
      </Show>

      <Show when={activityStore.activityLoadError() && rows().length > 0}>
        <div class="activity-load-notice flex-center gap-sm activity-load-warning">
          <span>Couldn't refresh activity.</span>
          <Button onClick={activityStore.ensureActivityLoaded} size="sm">
            Try again
          </Button>
        </div>
      </Show>

      <Show when={activityStore.activityReadSyncError()}>
        <div class="activity-load-notice flex-center gap-sm activity-load-warning">
          <span>Couldn't sync your read state.</span>
          <Button
            disabled={activityStore.activityReadSyncPending()}
            onClick={activityStore.retryActivityReadSync}
            size="sm"
          >
            {activityStore.activityReadSyncPending() ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </Show>

      <Show when={activityStore.activityLoaded() || rows().length > 0}>
        <Show
          fallback={
            <div class="activity-empty flex-col empty-state">
              <Icon name="check-circle" size={28} />
              <Show when={!activityStore.activityLoadingMore()}>
                <div>Nothing in {selectedTagLabel().toLowerCase()}.</div>
              </Show>
            </div>
          }
          when={visibleRows().length > 0}
        >
          <div class="activity-list flex-col" ref={listRef}>
            <For each={groupedVisibleRows()}>
              {(entry) =>
                entry.kind === "divider" ? (
                  <div class="activity-day-divider message-divider day-divider flex-align-center text-center font-bold text-xs">
                    <span>{entry.day}</span>
                  </div>
                ) : (
                  <ActivityRow onSeen={activityStore.markActivityItemsRead} row={entry.row} />
                )
              }
            </For>
          </div>

          <Show when={activityStore.activityLoadMoreError()}>
            <div class="activity-load-notice flex-center gap-sm activity-load-warning">
              <span>Couldn't load more activity.</span>
              <Button
                onClick={() =>
                  activityStore.loadMoreActivity(activeFeedTypes(), activeUnreadOnly())
                }
                size="sm"
              >
                Try again
              </Button>
            </div>
          </Show>
        </Show>

        <Show when={activityStore.activityHasMore(activeFeedTypes(), activeUnreadOnly())}>
          <div
            class="activity-load-notice flex-center gap-sm text-dim text-sm"
            classList={{ "activity-load-idle": !activityStore.activityLoadingMore() }}
          >
            Loading more…
          </div>
        </Show>
      </Show>
    </div>
  );
}
