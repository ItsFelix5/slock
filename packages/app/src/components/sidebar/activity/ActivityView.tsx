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
  TAG_FILTERS,
  type Tag,
} from "./activityViewFilters";

const NEAR_BOTTOM_VIEWPORT_FRACTION = 1.5;
// Caps the auto top-up effect's consecutive fetches per filter combo — see
// its comment below for why an unbounded version can loop forever.
const MAX_AUTO_TOP_UP_ATTEMPTS = 25;

export default function ActivityView() {
  const [selectedTag, setSelectedTag] = createSignal<Tag | "all">("all");
  const [keyword, setKeyword] = createSignal("");
  const [readState, setReadState] = createSignal<ReadState>("all");

  // On a hard refresh landing straight on /activity, wait for both identity
  // and notification preferences. The latter determines which aggregate
  // `channel` badges need to be hydrated as all-new-post rows. A failed prefs
  // load still allows the server-authored activity feed to render.
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
      // Reactions carry threadTs purely so read-tracking can match a later
      // reply to them (see resolveActivityEntry) — they never belong in the
      // thread's grouped timeline. A reaction is always its own row, shown
      // as a single message with its reaction inline.
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

  // tagAndSearchRows only holds what's been paginated in so far, so a count
  // taken from it mid-scroll is really "how far I've scrolled" rather than a
  // true total — it grows every time another page loads, which reads as a
  // buggy, made-up number. Only trust it once that pagination scope has
  // actually run dry; until then, show no badge rather than a wrong one. The
  // "unread" scope is also satisfied once the *general* scope is exhausted,
  // since that implies every unread item was loaded along the way too.
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

  // Feed entries stay day-grouped even while unread items further down keep
  // arriving from the gateway, so a divider is only ever inserted between two
  // rows that actually land on different calendar days.
  //
  // Grouped by `time` (when the activity happened / was recorded in the
  // feed), not `ts` (the underlying message's own timestamp) — rows are
  // sorted by `time` above, and a reaction on an old message keeps its
  // message's original `ts` while `time` reflects today. Grouping by `ts`
  // there would print a stale day divider out of order with its neighbors.
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
  // Mirrors Slack's own `unread_only` param for its "Unread" tab, so that
  // page of the feed is filtered server-side instead of client-only.
  const activeUnreadOnly = createMemo(() => readState() === "unread");

  // biome-ignore lint/suspicious/noUnassignedVariables: Solid.js assigns via ref attribute
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

  // A short result set (a narrow tag filter, a small workspace) can render
  // without ever producing a scrollbar — handleScroll would then never fire,
  // so top up the feed until it either fills the viewport or runs out. Some
  // filters (readState "read"/"reacted") have no server-side equivalent, so
  // a page can come back non-empty from Slack yet still add zero visible
  // rows once filtered client-side — that would otherwise never trip
  // `activityHasMore` false and this effect would keep re-firing forever.
  // Cap consecutive attempts per filter combo so it gives up instead.
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
        <div class="activity-load-state empty-state" role="status">
          Loading activity…
        </div>
      </Show>

      <Show when={store.activity.activityLoadError() && rows().length === 0}>
        <div class="activity-load-state activity-load-error empty-state" role="alert">
          <span>Couldn’t load activity.</span>
          <Button onClick={store.activity.ensureActivityLoaded} size="sm">
            Try again
          </Button>
        </div>
      </Show>

      <Show when={store.activity.activityLoadError() && rows().length > 0}>
        <div class="activity-load-notice activity-load-warning" role="alert">
          <span>Couldn’t refresh activity.</span>
          <Button onClick={store.activity.ensureActivityLoaded} size="sm">
            Try again
          </Button>
        </div>
      </Show>

      <Show when={store.activity.activityReadSyncError()}>
        <div class="activity-load-notice activity-load-warning" role="alert">
          <span>Couldn’t sync your read state.</span>
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
            <div class="activity-load-notice text-dim text-sm" role="status">
              Loading more…
            </div>
          </Show>

          <Show when={store.activity.activityLoadMoreError()}>
            <div class="activity-load-notice activity-load-warning" role="alert">
              <span>Couldn’t load more activity.</span>
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
