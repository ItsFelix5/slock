import type { ChannelMembersPage, User } from "@slock/types";
import { confirmDialog, createDebouncedRequest } from "@slock/ui";
import { createEffect, createMemo, createSignal, on } from "solid-js";
import { store } from "../../../lib/store";
import { createKeyedPageLoader } from "../channel-details/keyedPageLoader";
import {
  inviteUsersToChannel,
  loadChannelManagerIds,
  loadChannelMembersPage,
  type MemberFilter,
  removeUserFromChannel,
  searchChannelMembers,
} from "./channelDetails";

type PagedFilter = "everyone" | "apps";

const SCROLL_LOAD_THRESHOLD = 160;

const pagedKeyFor = (filter: MemberFilter): PagedFilter | undefined =>
  filter === "managers" ? undefined : filter;

function createPendingIds() {
  const [ids, setIds] = createSignal<ReadonlySet<string>>(new Set());
  const has = (id: string) => ids().has(id);
  async function run<T>(id: string, task: () => Promise<T>) {
    setIds((current) => new Set(current).add(id));
    try {
      return await task();
    } finally {
      setIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }
  return { has, run };
}

export function createChannelMembers(deps: {
  channelId: () => string;
  channelName: () => string;
  memberCount: () => number | undefined;
  onMembersChanged?: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<MemberFilter>("everyone");
  const [pagedMembers, setPagedMembers] = createSignal<Record<PagedFilter, User[]>>({
    apps: [],
    everyone: [],
  });
  const [pagedCursors, setPagedCursors] = createSignal<Record<PagedFilter, string | undefined>>({
    apps: undefined,
    everyone: undefined,
  });
  const [managerIds, setManagerIds] = createSignal<string[]>([]);
  const [loadingManagers, setLoadingManagers] = createSignal(false);
  const [managersLoaded, setManagersLoaded] = createSignal(false);
  const removing = createPendingIds();
  const adding = createPendingIds();

  const pagedLoader = createKeyedPageLoader<PagedFilter, ChannelMembersPage>({
    load: (f) => loadChannelMembersPage(deps.channelId(), f, pagedCursors()[f]),
    onResult: (f, page) => {
      const known = new Set(pagedMembers()[f].map((u) => u.id));
      setPagedMembers((prev) => ({
        ...prev,
        [f]: [...prev[f], ...page.members.filter((u) => !known.has(u.id))],
      }));
      setPagedCursors((prev) => ({ ...prev, [f]: page.nextCursor }));
    },
  });
  const loadMore = (f: PagedFilter) => pagedLoader.load(f);

  const loadManagers = async () => {
    if (managersLoaded() || loadingManagers()) return;
    setLoadingManagers(true);
    try {
      setManagerIds(await loadChannelManagerIds(deps.channelId()));
    } catch {
      setManagerIds([]);
    } finally {
      setManagersLoaded(true);
      setLoadingManagers(false);
    }
  };

  void loadManagers();
  createEffect(
    on(filter, (f) => {
      const key = pagedKeyFor(f);
      if (key && !pagedLoader.hasLoaded(key)) void loadMore(key);
    }),
  );

  const filterCount = (f: MemberFilter): number | undefined => {
    if (f === "everyone") return deps.memberCount();
    if (f === "managers") return managersLoaded() ? managerIds().length : undefined;
    return pagedLoader.hasLoaded("apps") && !pagedCursors().apps
      ? pagedMembers().apps.length
      : undefined;
  };

  const visibleMembers = createMemo(() => {
    const f = filter();
    if (f === "managers")
      return managerIds()
        .map((id) => store.users.userById(id))
        .filter((u) => u !== undefined);
    return pagedMembers()[f];
  });
  const searchActive = () => filter() === "everyone" && !!query().trim();
  const filteredMembers = createMemo(() => {
    if (searchActive()) return searchResults()?.inChannel ?? [];
    const q = query().trim().toLowerCase();
    return q ? visibleMembers().filter((u) => u.name.toLowerCase().includes(q)) : visibleMembers();
  });

  const isLoading = createMemo(() => {
    const key = pagedKeyFor(filter());
    return key ? pagedLoader.isLoading(key) : loadingManagers();
  });
  const loadError = createMemo(() => {
    const key = pagedKeyFor(filter());
    return key ? pagedLoader.hasError(key) : false;
  });
  const retryLoad = () => {
    const key = pagedKeyFor(filter());
    if (key) void loadMore(key);
  };
  const loadErrorLabel = () => {
    if (filter() === "managers") return "channel managers";
    return filter() === "apps" ? "apps" : "members";
  };
  const loadMoreAtBottom = (el: HTMLDivElement) => {
    const key = pagedKeyFor(filter());
    if (!(key && pagedCursors()[key]) || pagedLoader.isLoading(key)) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_THRESHOLD) loadMore(key);
  };

  type SearchResults = { inChannel: User[]; directory: User[] };
  const [searchResults, setSearchResults] = createSignal<SearchResults>();
  const [searching, setSearching] = createSignal(false);
  const searchRequest = createDebouncedRequest<SearchResults>(
    async (q) => {
      const [inChannel, directory] = await Promise.all([
        searchChannelMembers(deps.channelId(), q),
        store.users.searchUsers(q),
      ]);
      return { directory, inChannel };
    },
    {
      onPendingChange: setSearching,
      onReset: () => setSearchResults(undefined),
      onResult: setSearchResults,
    },
  );
  const runSearch = () => searchRequest.run(searchActive() ? query() : "");
  createEffect(runSearch);

  const nonMembers = createMemo(() => {
    const results = searchResults();
    if (!(searchActive() && results)) return [];
    const inChannel = new Set(results.inChannel.map((u) => u.id));
    return results.directory.filter((u) => !inChannel.has(u.id));
  });

  const showEmpty = () =>
    !(isLoading() || loadError()) && filteredMembers().length === 0 && nonMembers().length === 0;
  const emptyLabel = () => {
    if (query().trim()) return "No matches.";
    if (filter() === "managers") return "No channel managers.";
    return filter() === "apps" ? "No apps in this channel." : "No members.";
  };
  const showSearching = () => searching() && searchActive();

  const membersChanged = () => {
    store.channels.invalidateChannelRoster(deps.channelId());
    runSearch();
    deps.onMembersChanged?.();
  };

  const addPerson = (user: User) =>
    adding.has(user.id)
      ? undefined
      : adding.run(user.id, async () => {
          if (!(await inviteUsersToChannel(deps.channelId(), [user.id]))) return;
          setPagedMembers((prev) => ({
            ...prev,
            everyone: prev.everyone.some((u) => u.id === user.id)
              ? prev.everyone
              : [user, ...prev.everyone],
          }));
          membersChanged();
        });

  async function removeMember(user: User) {
    if (removing.has(user.id)) return;
    const confirmed = await confirmDialog({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${user.name} from #${deps.channelName()}?`,
    });
    if (!confirmed) return;
    await removing.run(user.id, async () => {
      if (!(await removeUserFromChannel(deps.channelId(), user.id))) return;
      setPagedMembers((prev) => ({
        apps: prev.apps.filter((u) => u.id !== user.id),
        everyone: prev.everyone.filter((u) => u.id !== user.id),
      }));
      setManagerIds((prev) => prev.filter((id) => id !== user.id));
      membersChanged();
    });
  }

  return {
    addPerson,
    emptyLabel,
    filter,
    filterCount,
    filteredMembers,
    isAdding: adding.has,
    isLoading,
    isManager: (id: string) => managerIds().includes(id),
    isRemoving: removing.has,
    loadError,
    loadErrorLabel,
    loadMoreAtBottom,
    nonMembers,
    query,
    removeMember,
    retryLoad,
    setFilter,
    setQuery,
    showEmpty,
    showSearching,
  };
}
