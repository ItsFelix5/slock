import { createQueue, type Env } from "@slock/core";
import type { ActivityItem, ChannelId, FeedEntry, Message, Ts, User, UserId } from "@slock/types";
import { createEffect, createMemo, createSignal, onCleanup, refresh, untrack } from "solid-js";
import { needsMessage } from "../kinds";
import { createActivityFeedRefreshScheduler } from "./activityFeedRefresh";
import type { ActivityItems } from "./activityItems";
import { createEntryResolution } from "./entryResolution";
import { applyStaleEntries, seenSetsFor, staleEntries } from "./feedMerge";
import { createFeedScopes, MAIN_SCOPE, scopeKey } from "./feedScopes";

const LIVE_ACTIVITY_REFRESH_DELAY_MS = 250;
const PAGE_SIZE = 50;

type MoreRequest = { id: number; types?: string; unreadOnly?: boolean };

type ActivityFeedLoadDeps = {
  items: ActivityItems;
  cacheResolvedMessages?: (messages: Map<string, Message>) => void;
  currentUser: () => User | undefined;
  ready: () => boolean;
  env: Env;
  backfillMissingReadCursors: (items: readonly ActivityItem[]) => Promise<void>;
  fetchActivityFeedEntries: (
    limit?: number,
    cursor?: string,
    types?: string,
    unreadOnly?: boolean,
  ) => Promise<{ entries: FeedEntry[]; nextCursor?: string }>;
  fetchHistoryAround: (
    channelId: ChannelId,
    ts: Ts,
    limit: number,
  ) => Promise<{ messages: Message[] }>;
  fetchMessagesByIds: (
    entries: { channelId: ChannelId; ts: Ts }[],
  ) => Promise<Map<string, Message>>;
  isBotUser?: (userId: UserId) => boolean;
  onReactionPushed?: (name: string) => void;
  resolveActivityEntry: (entry: FeedEntry, batch?: Map<string, Message>) => ActivityItem;
};

export function createActivityFeedLoad(deps: ActivityFeedLoadDeps) {
  const { createEntryPusher, resolvePendingEntries } = createEntryResolution(deps);
  const scopes = createFeedScopes();
  const queue = createQueue(1);
  let jobs = 0;

  async function enqueue(job: () => Promise<void>): Promise<void> {
    jobs++;
    try {
      await queue.run(() => untrack(job));
    } finally {
      jobs--;
    }
  }

  function backfill(pushed: readonly ActivityItem[]) {
    untrack(() => {
      void deps.backfillMissingReadCursors([...deps.items.list, ...pushed]);
    });
  }

  async function mergePage(me: User, entries: FeedEntry[]) {
    const { seen, seenChannelPosts, seenReactions } = untrack(() => seenSetsFor(deps.items.list));
    const pending = entries.filter((entry) => !seen.has(entry.id));
    const { push, pushed } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
    await resolvePendingEntries(pending, seen, seenChannelPosts, push);
    return pushed;
  }

  async function reloadStale(me: User, entries: FeedEntry[]) {
    const stale = untrack(() => staleEntries(entries, deps.items.list));
    if (!stale.length) return;
    const batch = await deps.fetchMessagesByIds(stale.filter(needsMessage));
    if (batch.size) deps.cacheResolvedMessages?.(batch);
    deps.items.update((list) =>
      applyStaleEntries(list, stale, deps.resolveActivityEntry, batch, me),
    );
  }

  async function mergeNewest(me: User, entries: FeedEntry[]) {
    const pushed = await mergePage(me, entries);
    await reloadStale(me, entries);
    backfill(pushed);
  }

  async function loadNewest(me: User) {
    const page = await deps.fetchActivityFeedEntries();
    scopes.record(MAIN_SCOPE, page, true);
    await mergeNewest(me, page.entries);
  }

  async function loadOlder(me: User, { types, unreadOnly }: MoreRequest) {
    const key = scopeKey(types, unreadOnly);
    const page = await deps.fetchActivityFeedEntries(
      PAGE_SIZE,
      scopes.cursor(key),
      types,
      unreadOnly,
    );
    scopes.record(key, page);
    const pushed = await mergePage(me, page.entries);
    backfill(pushed);
  }

  const feed = createMemo(async () => {
    const me = deps.currentUser();
    if (!(deps.ready() && me)) return false;
    await enqueue(() => loadNewest(me));
    return true;
  });

  const [moreRequest, setMoreRequest] = createSignal<MoreRequest>();
  let requestId = 0;

  const more = createMemo(async () => {
    const request = moreRequest();
    const me = deps.currentUser();
    if (!(request && me)) return request;
    await enqueue(() => loadOlder(me, request));
    return request;
  });

  createEffect(feed, {
    effect: () => {},
    error: (err) => console.error("Failed to load activity", err),
  });
  createEffect(more, {
    effect: () => {},
    error: (err) => console.error("Failed to load more activity", err),
  });

  function loadMoreActivity(types?: string, unreadOnly?: boolean): void {
    if (!scopes.loaded() || jobs || !scopes.hasMore(scopeKey(types, unreadOnly))) return;
    setMoreRequest({ id: ++requestId, types, unreadOnly });
  }

  const liveRefresh = createActivityFeedRefreshScheduler({
    delayMs: LIVE_ACTIVITY_REFRESH_DELAY_MS,
    env: deps.env,
    isLoading: () => jobs > 0,
    refresh: () =>
      refresh(feed).then(
        () => {},
        () => {},
      ),
  });

  onCleanup(liveRefresh.cancel);

  function applyLiveEntry(entry: FeedEntry): void {
    const me = untrack(deps.currentUser);
    if (!me) return;
    enqueue(async () => {
      if (scopes.loaded()) await mergeNewest(me, [entry]);
    }).catch((err) => console.error("Failed to apply activity", err));
  }

  return {
    activityFeed: feed,
    activityLoaded: scopes.loaded,
    activityHasMore: (types?: string, unreadOnly?: boolean) =>
      scopes.hasMore(scopeKey(types, unreadOnly)),
    activityMore: more,
    applyLiveEntry,
    loadMoreActivity,
    requestActivityRefresh: liveRefresh.request,
    retryActivityLoad: () => refresh(feed),
  };
}
