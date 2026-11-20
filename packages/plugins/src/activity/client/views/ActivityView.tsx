import { formatDayFromMs } from "@slock/core";
import { service } from "@slock/core/solid";
import { Button, Icon, initRovingTabIndexDefault } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { createPingCoverage } from "../kinds";
import ActivityRow, { type ActivityRow as ActivityRowData } from "./ActivityRow";
import ActivityToolbar from "./ActivityToolbar";
import { ActivityFeedStatus, ActivityMoreStatus, WhenMoreIdle } from "./activityLoadStatus";
import { openActivityRow } from "./activityRowOpen";
import { createActivityTopUp } from "./activityTopUp";
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
const sidebarStore = service("sidebar");

export default function ActivityView() {
  let listRef: HTMLDivElement | undefined;
  onCleanup(() => activityStore.setCurrentRowKey(undefined));
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
    if (tag === "all") {
      const isCovered = createPingCoverage(activityStore.activityItems);
      return rows().filter((row) => !row.items.every(isCovered));
    }
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

  sidebarStore.provideCycle(0, () =>
    visibleRows().map((row) => ({
      active: activityStore.currentRowKey() === row.key,
      open: (split) => openActivityRow(row, split),
    })),
  );

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
  const topUp = createActivityTopUp({
    container: () => scrollRef,
    key: () => `${selectedTag()}|${readState()}`,
    rows: visibleRows,
    types: activeFeedTypes,
    unreadOnly: activeUnreadOnly,
  });

  return (
    <div class="activity-view" onScroll={topUp.onScroll} ref={scrollRef}>
      <ActivityToolbar
        onReadStateChange={setReadState}
        onSelectTag={setSelectedTag}
        readState={readState()}
        selectedTag={selectedTag()}
        tabCount={tabCount}
      />

      <ActivityFeedStatus empty={rows().length === 0} />

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

      <Show when={rows().length > 0 || activityStore.activityLoaded()}>
        <Show
          fallback={
            <div class="activity-empty flex-col empty-state">
              <Icon name="check-circle" size={28} />
              <WhenMoreIdle>
                <div>Nothing in {selectedTagLabel().toLowerCase()}.</div>
              </WhenMoreIdle>
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
        </Show>

        <ActivityMoreStatus types={activeFeedTypes()} unreadOnly={activeUnreadOnly()} />
      </Show>
    </div>
  );
}
