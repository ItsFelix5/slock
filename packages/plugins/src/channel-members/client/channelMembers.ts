import { service } from "@slock/core/solid";
import type { MemberFilter } from "@slock/plugins/channel-details/client/api";
import type { ChannelId, ChannelMembersPage, User, UserId } from "@slock/types";
import { createDebouncedSearch, isNearScrollEnd } from "@slock/ui";
import { createEffect, createMemo, createSignal, onSettled, untrack } from "solid-js";
import { createKeyedPageLoader } from "./keyedPageLoader";

const dialogs = service("shell.dialogs");

const channelDetails = service("channel-details");

const channelsStore = service("channels");
const usersStore = service("users");

type PagedFilter = "everyone" | "apps";

const SCROLL_LOAD_THRESHOLD = 160;
const MEMBER_SEARCH_DELAY_MS = 250;

const pagedKeyFor = (filter: MemberFilter): PagedFilter | undefined =>
  filter === "managers" ? undefined : filter;

function createPendingIds() {
  const [ids, setIds] = createSignal<ReadonlySet<UserId>>(new Set());
  const has = (id: UserId) => ids().has(id);
  async function run<T>(id: UserId, task: () => Promise<T>) {
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
  channelId: () => ChannelId;
  channelName: () => string;
  list: () => HTMLElement | undefined;
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
  const [managerIds, setManagerIds] = createSignal<UserId[]>([]);
  const [loadingManagers, setLoadingManagers] = createSignal(false);
  const [managersLoaded, setManagersLoaded] = createSignal(false);
  const removing = createPendingIds();
  const adding = createPendingIds();

  const pagedLoader = createKeyedPageLoader<PagedFilter, ChannelMembersPage>({
    load: (f) => channelDetails.loadChannelMembersPage(deps.channelId(), f, pagedCursors()[f]),
    onResult: (f, page) => {
      setPagedMembers((prev) => {
        const known = new Set(prev[f].map((u) => u.id));
        return { ...prev, [f]: [...prev[f], ...page.members.filter((u) => !known.has(u.id))] };
      });
      setPagedCursors((prev) => ({ ...prev, [f]: page.nextCursor }));
    },
  });
  const loadMore = (f: PagedFilter) => pagedLoader.load(f);

  const loadManagers = async () => {
    if (managersLoaded() || loadingManagers()) return;
    setLoadingManagers(true);
    try {
      setManagerIds(await channelDetails.loadChannelManagerIds(deps.channelId()));
    } catch {
      setManagerIds([]);
    } finally {
      setManagersLoaded(true);
      setLoadingManagers(false);
    }
  };

  onSettled(() => void loadManagers());
  createEffect(
    () => pagedKeyFor(filter()),
    (key) => {
      if (key && !untrack(() => pagedLoader.hasLoaded(key))) untrack(() => void loadMore(key));
    },
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
        .map((id) => usersStore.userById(id))
        .filter((u) => u !== undefined);
    return pagedMembers()[f];
  });
  const searchActive = () => filter() === "everyone" && !!query().trim();
  const filteredMembers = createMemo(() => {
    if (searchActive()) return memberSearch.value().inChannel;
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
  const nextPageKey = createMemo(() => {
    const key = pagedKeyFor(filter());
    return key && pagedCursors()[key] && !pagedLoader.isLoading(key) ? key : undefined;
  });
  const loadMoreAtBottom = (el: HTMLElement) => {
    const key = untrack(nextPageKey);
    if (key && isNearScrollEnd(el, SCROLL_LOAD_THRESHOLD)) untrack(() => void loadMore(key));
  };
  createEffect(
    () => ({ key: nextPageKey(), list: deps.list() }),
    ({ key, list }) => {
      if (key && list) loadMoreAtBottom(list);
    },
  );

  const memberSearch = createDebouncedSearch<{ inChannel: User[]; directory: User[] }>({
    delay: MEMBER_SEARCH_DELAY_MS,
    empty: { directory: [], inChannel: [] },
    search: async (q) => {
      const [inChannel, directory] = await Promise.all([
        channelDetails.searchChannelMembers(deps.channelId(), q),
        usersStore.searchUsers(q),
      ]);
      return { directory, inChannel };
    },
  });
  const activeSearchTerm = () => (searchActive() ? query() : "");
  createEffect(activeSearchTerm, (term) => {
    memberSearch.set(term);
  });

  const nonMembers = createMemo(() => {
    if (!searchActive()) return [];
    const results = memberSearch.value();
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
  const showSearching = () => memberSearch.searching() && searchActive();

  const membersChanged = () => {
    channelsStore.invalidateChannelRoster(deps.channelId());
    memberSearch.refresh();
    deps.onMembersChanged?.();
  };

  const addPerson = (user: User) =>
    adding.has(user.id)
      ? undefined
      : adding.run(user.id, async () => {
          if (!(await channelDetails.inviteUsersToChannel(deps.channelId(), [user.id]))) return;
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
    const confirmed = await dialogs.confirm({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${user.name} from #${deps.channelName()}?`,
    });
    if (!confirmed) return;
    await removing.run(user.id, async () => {
      if (!(await channelDetails.removeUserFromChannel(deps.channelId(), user.id))) return;
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
    isManager: (id: UserId) => managerIds().includes(id),
    isRemoving: removing.has,
    loadError,
    loadErrorLabel,
    loadMoreAtBottom,
    nonMembers,
    query,
    removeMember,
    retryLoad,
    setFilter: (next: MemberFilter) => setFilter(next),
    setQuery: (next: string) => setQuery(next),
    showEmpty,
    showSearching,
  };
}
