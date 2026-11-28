import { service } from "@slock/core/solid";
import { createTypeahead } from "@slock/plugins/query/client/api";
import { type EntryState, isWaiting } from "@slock/resource";
import type { ChannelId, User, UserId } from "@slock/types";
import { isNearScrollEnd } from "@slock/ui";
import { createEffect, createMemo, createSignal, untrack } from "solid-js";
import {
  adding,
  type MemberFilter,
  type MembersArg,
  memberKey,
  memberMatches,
  memberPages,
  promoting,
  removing,
} from "./store";

const dialogs = service("shell.dialogs");

const channelsStore = service("channels");
const usersStore = service("users");

const SCROLL_LOAD_THRESHOLD = 160;
const MEMBER_SEARCH_DELAY_MS = 250;

const awaiting = (state: EntryState<unknown>) =>
  isWaiting(state) || (state.data === undefined && state.refreshing);

export function createChannelMembers(deps: {
  channelId: () => ChannelId;
  channelName: () => string;
  groupChat: () => boolean;
  list: () => HTMLElement | undefined;
  memberCount: () => number | undefined;
  onMembersChanged?: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<MemberFilter>("everyone");
  const [appsOpened, setAppsOpened] = createSignal(false);

  const pageArg = createMemo((): MembersArg | undefined => {
    const current = filter();
    return current === "managers" ? undefined : { channelId: deps.channelId(), filter: current };
  });
  const page = memberPages.state(pageArg);
  const apps = memberPages.state(() =>
    appsOpened() ? { channelId: deps.channelId(), filter: "apps" } : undefined,
  );
  const managers = channelsStore.channelManagersState(() =>
    deps.groupChat() ? undefined : deps.channelId(),
  );
  const isManager = (id: UserId) => !!managers().data?.has(id);

  const filterCount = (f: MemberFilter): number | undefined => {
    if (f === "everyone") return deps.memberCount();
    if (f === "managers") return managers().data?.size;
    const loaded = apps().data;
    return loaded && loaded.next === undefined ? loaded.items.length : undefined;
  };

  const visibleMembers = createMemo(() => {
    if (filter() !== "managers") return page().data?.items ?? [];
    return [...(managers().data ?? [])]
      .map((id) => usersStore.userById(id))
      .filter((u) => u !== undefined);
  });
  const searchActive = () => filter() === "everyone" && !!query().trim();
  const memberSearch = createTypeahead(memberMatches, {
    arg: (term) => ({ channelId: deps.channelId(), directory: !deps.groupChat(), term }),
    delay: MEMBER_SEARCH_DELAY_MS,
    empty: { directory: [], inChannel: [] },
  });
  const activeSearchTerm = () => (searchActive() ? query() : "");
  createEffect(activeSearchTerm, (term) => {
    memberSearch.set(term);
  });
  const filteredMembers = createMemo(() => {
    if (searchActive()) return memberSearch.value().inChannel;
    const q = query().trim().toLowerCase();
    return q ? visibleMembers().filter((u) => u.name.toLowerCase().includes(q)) : visibleMembers();
  });

  const isLoading = createMemo(() => {
    const arg = pageArg();
    return arg ? awaiting(page()) || memberPages.loadingMore(arg) : awaiting(managers());
  });
  const loadError = createMemo(() => {
    if (searchActive()) return memberSearch.failed();
    const arg = pageArg();
    return arg ? !!page().error || memberPages.moreFailed(arg) : !!managers().error;
  });
  const retryLoad = () => {
    if (searchActive()) return memberSearch.retry();
    const arg = pageArg();
    if (!arg) void channelsStore.ensureChannelManagers(deps.channelId()).catch(() => {});
    else if (page().error) void memberPages.refresh(arg).catch(() => {});
    else void memberPages.more(arg);
  };
  const loadErrorLabel = () => {
    if (filter() === "managers") return "channel managers";
    return filter() === "apps" ? "apps" : "members";
  };
  const nextPageArg = createMemo(() => {
    const arg = pageArg();
    return arg && page().data?.next !== undefined && !memberPages.loadingMore(arg)
      ? arg
      : undefined;
  });
  const loadMoreAtBottom = (el: HTMLElement) =>
    untrack(() => {
      const arg = nextPageArg();
      if (arg && isNearScrollEnd(el, SCROLL_LOAD_THRESHOLD)) void memberPages.more(arg);
    });
  createEffect(
    () => {
      const arg = nextPageArg();
      return {
        arg: arg && !memberPages.moreFailed(arg) ? arg : undefined,
        list: deps.list(),
        pages: page().data?.pages,
      };
    },
    ({ arg, list }) => {
      if (arg && list) loadMoreAtBottom(list);
    },
  );

  const nonMembers = createMemo(() => {
    if (!searchActive()) return [];
    const results = memberSearch.value();
    const inChannel = new Set(results.inChannel.map((u) => u.id));
    return results.directory.filter((u) => !inChannel.has(u.id));
  });

  const showSearching = () => memberSearch.searching() && searchActive();
  const showEmpty = () =>
    !(isLoading() || loadError() || showSearching()) &&
    filteredMembers().length === 0 &&
    nonMembers().length === 0;
  const emptyLabel = () => {
    if (query().trim()) return "No matches.";
    if (filter() === "managers") return "No channel managers.";
    return filter() === "apps" ? "No apps in this channel." : "No members.";
  };

  const changeMembership = async (change: typeof adding, user: User) => {
    if (await change.run({ channelId: deps.channelId(), user })) deps.onMembersChanged?.();
  };

  async function removeMember(user: User) {
    if (removing.pending(memberKey(deps.channelId(), user.id))) return;
    const confirmed = await dialogs.confirm({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${user.name} from #${deps.channelName()}?`,
    });
    if (confirmed) await changeMembership(removing, user);
  }

  return {
    addPerson: (user: User) => changeMembership(adding, user),
    emptyLabel,
    filter,
    filterCount,
    filteredMembers,
    isAdding: (id: UserId) => adding.pending(memberKey(deps.channelId(), id)),
    isLoading,
    isManager,
    isPromoting: (id: UserId) => promoting.pending(memberKey(deps.channelId(), id)),
    isRemoving: (id: UserId) => removing.pending(memberKey(deps.channelId(), id)),
    loadError,
    loadErrorLabel,
    loadMoreAtBottom,
    makeManager: (user: User) => promoting.run({ channelId: deps.channelId(), user }),
    nonMembers,
    query,
    removeMember,
    retryLoad,
    setFilter: (next: MemberFilter) => {
      if (next === "apps") setAppsOpened(true);
      setFilter(next);
    },
    setQuery: (next: string) => setQuery(next),
    showEmpty,
    showSearching,
  };
}
