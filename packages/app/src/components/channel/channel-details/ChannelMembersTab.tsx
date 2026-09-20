import {
  Avatar,
  Button,
  confirmDialog,
  createCopyFeedback,
  createDebouncedRequest,
  IconButton,
  initRovingTabIndexDefault,
  SegmentedControl,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js";
import type { ChannelMembersPage, User } from "../../../lib/api";
import { actionFeedback } from "../../../lib/feedback";
import { store } from "../../../lib/store";
import {
  inviteUsersToChannel,
  loadChannelManagerIds,
  loadChannelMembersPage,
  type MemberFilter,
  removeUserFromChannel,
} from "../lib/channelDetails";
import "./ChannelDetails.css";
import { createKeyedPageLoader } from "./keyedPageLoader";

type PagedFilter = "everyone" | "apps";

const MEMBER_FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "everyone", label: "Everyone" },
  { key: "managers", label: "Channel managers" },
  { key: "apps", label: "Apps" },
];

function pagedKeyFor(f: MemberFilter): PagedFilter | undefined {
  if (f === "managers") return;
  return f === "apps" ? "apps" : "everyone";
}

const SCROLL_LOAD_THRESHOLD = 160;

function MemberRow(props: { action: JSX.Element; isManager: boolean; user: User }) {
  return (
    <div class="channel-details-member flex-align-center">
      <button
        class="channel-details-member-main btn-reset flex-align-center"
        data-nav-row
        onClick={() => store.users.openUserProfile(props.user.id)}
        tabIndex={-1}
        type="button"
      >
        <Avatar size="small" user={props.user} />
        <span class="channel-details-member-name truncate">{props.user.name}</span>
        <Show when={props.isManager}>
          <span class="channel-details-member-badge">Manager</span>
        </Show>
        <Show when={props.user.isBot}>
          <span class="channel-details-member-badge">APP</span>
        </Show>
      </button>
      {props.action}
    </div>
  );
}

export default function ChannelMembersTab(props: {
  channelId: string;
  channelName: string;
  onMembersChanged?: () => void;
}) {
  let listRef: HTMLDivElement | undefined;
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
  let managersLoaded = false;

  const [copiedKey, copy] = createCopyFeedback(1200, () =>
    actionFeedback.flash(props.channelId, "Couldn't copy the member list.", "error"),
  );

  const [removingMemberIds, setRemovingMemberIds] = createSignal<Set<string>>(new Set());
  const [addingUserIds, setAddingUserIds] = createSignal<Set<string>>(new Set());

  const pagedLoader = createKeyedPageLoader<PagedFilter, ChannelMembersPage>({
    load: (f) => loadChannelMembersPage(props.channelId, f, pagedCursors()[f]),
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
    if (managersLoaded || loadingManagers()) return;
    setLoadingManagers(true);
    try {
      setManagerIds(await loadChannelManagerIds(props.channelId));
    } catch {
      setManagerIds([]);
    } finally {
      managersLoaded = true;
      setLoadingManagers(false);
    }
  };

  createEffect(
    on(filter, (f) => {
      const key = pagedKeyFor(f);
      if (!key) {
        void loadManagers();
        return;
      }
      if (!pagedLoader.hasLoaded(key)) void loadMore(key);
    }),
  );

  createEffect(() => void store.channels.ensureChannelRoster(props.channelId));

  const resolvedManagers = createMemo(() =>
    managerIds()
      .map((id) => store.users.userById(id))
      .filter((u): u is User => !!u),
  );

  const visibleMembers = createMemo(() => {
    const f = filter();
    if (f === "managers") return resolvedManagers();
    if (f === "apps") return pagedMembers().apps;
    return pagedMembers()[f];
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
    if (filter() === "apps") return "apps";
    return "members";
  };

  const loadMoreAtBottom = (el: HTMLDivElement) => {
    const key = pagedKeyFor(filter());
    if (!(key && pagedCursors()[key]) || pagedLoader.isLoading(key)) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_THRESHOLD) loadMore(key);
  };

  const filteredMembers = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = visibleMembers();
    if (!q) return list;
    return list.filter((u) => u.name.toLowerCase().includes(q));
  });

  const [nonMemberResults, setNonMemberResults] = createSignal<User[]>([]);
  const [searchingNonMembers, setSearchingNonMembers] = createSignal(false);
  const nonMemberRequest = createDebouncedRequest<User[]>((q) => store.users.searchUsers(q), {
    onPendingChange: setSearchingNonMembers,
    onReset: () => setNonMemberResults([]),
    onResult: setNonMemberResults,
  });
  createEffect(() => nonMemberRequest.run(filter() === "everyone" ? query() : ""));

  const nonMembers = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (filter() !== "everyone" || !q) return [];
    const memberIds =
      store.channels.channelRosterIds(props.channelId) ??
      new Set([...pagedMembers().everyone, ...pagedMembers().apps].map((u) => u.id));
    const merged = new Map<string, User>();
    for (const u of store.users.knownUsers()) {
      if (!memberIds.has(u.id) && u.name.toLowerCase().includes(q)) merged.set(u.id, u);
    }
    for (const u of nonMemberResults()) {
      if (!memberIds.has(u.id)) merged.set(u.id, u);
    }
    return [...merged.values()];
  });

  initRovingTabIndexDefault(
    () => listRef,
    () => [...filteredMembers(), ...nonMembers()],
  );

  const showEmpty = () =>
    !(isLoading() || loadError()) && filteredMembers().length === 0 && nonMembers().length === 0;
  const emptyLabel = () => {
    if (query().trim()) return "No matches.";
    switch (filter()) {
      case "managers":
        return "No channel managers.";
      case "apps":
        return "No apps in this channel.";
      default:
        return "No members.";
    }
  };

  const addPerson = async (user: User) => {
    if (addingUserIds().has(user.id)) return;
    setAddingUserIds((current) => new Set(current).add(user.id));
    try {
      if (await inviteUsersToChannel(props.channelId, [user.id])) {
        setPagedMembers((prev) => ({
          ...prev,
          everyone: prev.everyone.some((u) => u.id === user.id)
            ? prev.everyone
            : [user, ...prev.everyone],
        }));
        store.channels.invalidateChannelRoster(props.channelId);
        props.onMembersChanged?.();
      }
    } finally {
      setAddingUserIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
    }
  };

  const removeMember = async (user: User) => {
    if (removingMemberIds().has(user.id)) return;

    const confirmed = await confirmDialog({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${user.name} from #${props.channelName}?`,
    });
    if (!confirmed) return;
    setRemovingMemberIds((current) => new Set(current).add(user.id));
    try {
      if (await removeUserFromChannel(props.channelId, user.id)) {
        setPagedMembers((prev) => ({
          apps: prev.apps.filter((u) => u.id !== user.id),
          everyone: prev.everyone.filter((u) => u.id !== user.id),
        }));
        setManagerIds((prev) => prev.filter((id) => id !== user.id));
        store.channels.invalidateChannelRoster(props.channelId);
        props.onMembersChanged?.();
      }
    } finally {
      setRemovingMemberIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
    }
  };

  return (
    <>
      <div class="channel-details-members-toolbar flex-align-center">
        <SegmentedControl class="channel-details-member-filter">
          <For each={MEMBER_FILTERS}>
            {(f) => (
              <button
                class="segmented-control-btn"
                classList={{ active: filter() === f.key }}
                onClick={() => setFilter(f.key)}
                type="button"
              >
                {f.label}
              </button>
            )}
          </For>
        </SegmentedControl>
        <IconButton
          class="channel-details-copy-btn"
          disabled={filteredMembers().length === 0}
          icon={copiedKey() === "members" ? "check" : "copy"}
          iconSize={15}
          label="Copy members"
          onClick={() =>
            void copy(
              filteredMembers()
                .map((u) => `<@${u.id}>`)
                .join(" "),
              "members",
            )
          }
        />
      </div>
      <input
        class="channel-details-input"
        onInput={(e) => setQuery(e.currentTarget.value)}
        placeholder="Find members"
        type="text"
        value={query()}
      />
      <Show when={loadError()}>
        <div class="channel-details-members-error">
          <span>Couldn't load {loadErrorLabel()}.</span>
          <Button disabled={isLoading()} onClick={retryLoad} size="sm">
            Try again
          </Button>
        </div>
      </Show>
      <div
        class="channel-details-member-list flex-col"
        onScroll={(e) => loadMoreAtBottom(e.currentTarget)}
        ref={listRef}
      >
        <For each={filteredMembers()}>
          {(u) => (
            <MemberRow
              action={
                <Show when={u.id !== store.users.currentUser()?.id}>
                  <IconButton
                    class="channel-details-member-remove"
                    disabled={removingMemberIds().has(u.id)}
                    icon="close-filled"
                    iconSize={14}
                    label="Remove from channel"
                    onClick={() => removeMember(u)}
                  />
                </Show>
              }
              isManager={managerIds().includes(u.id)}
              user={u}
            />
          )}
        </For>
        <Show when={nonMembers().length > 0}>
          <div class="channel-details-member-divider">Not in this channel</div>
          <For each={nonMembers()}>
            {(u) => (
              <MemberRow
                action={
                  <IconButton
                    class="channel-details-member-add"
                    disabled={addingUserIds().has(u.id)}
                    icon="user-add"
                    iconSize={14}
                    label="Add to channel"
                    onClick={() => addPerson(u)}
                  />
                }
                isManager={false}
                user={u}
              />
            )}
          </For>
        </Show>
        <Show when={showEmpty()}>
          <p class="channel-details-empty">{emptyLabel()}</p>
        </Show>
        <Show when={isLoading()}>
          <div class="channel-details-member-placeholder">Loading…</div>
        </Show>
        <Show when={searchingNonMembers() && filter() === "everyone" && query().trim()}>
          <div class="channel-details-member-placeholder">Searching…</div>
        </Show>
      </div>
    </>
  );
}
