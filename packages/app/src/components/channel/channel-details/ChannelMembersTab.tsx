import {
  Avatar,
  Button,
  confirmDialog,
  createCopyFeedback,
  Icon,
  initRovingTabIndexDefault,
  SegmentedControl,
  Tooltip,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import type { ChannelMembersPage, User } from "../../../lib/api";
import {
  inviteUsersToChannel,
  loadChannelManagerIds,
  loadChannelMembers,
  type MemberFilter,
  removeUserFromChannel,
} from "../../../lib/channelDetails";
import { actionFeedback } from "../../../lib/feedback";
import { store } from "../../../lib/store";
import ComposeUserPicker from "../../composer/popovers/ComposeUserPicker";
import "./ChannelDetails.css";
import { createKeyedPageLoader } from "./keyedPageLoader";

type PagedFilter = "everyone" | "apps";

const MEMBER_FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "everyone", label: "Everyone" },
  { key: "managers", label: "Channel managers" },
  { key: "apps", label: "Apps" },
];

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

  const [addingPeople, setAddingPeople] = createSignal(false);
  const [inviting, setInviting] = createSignal(false);
  const [removingMemberIds, setRemovingMemberIds] = createSignal<Set<string>>(new Set());

  const pagedLoader = createKeyedPageLoader<PagedFilter, ChannelMembersPage>({
    load: (f) => loadChannelMembers(props.channelId, f, pagedCursors()[f]),
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
      if (f === "managers") {
        void loadManagers();
        return;
      }
      if (!pagedLoader.hasLoaded(f)) void loadMore(f);
    }),
  );

  const resolvedManagers = createMemo(() =>
    managerIds()
      .map((id) => store.users.userById(id))
      .filter((u): u is User => !!u),
  );

  const visibleMembers = createMemo(() => {
    const f = filter();
    return f === "managers" ? resolvedManagers() : pagedMembers()[f];
  });

  const isLoading = createMemo(() =>
    filter() === "managers" ? loadingManagers() : pagedLoader.isLoading(filter() as PagedFilter),
  );
  const loadError = createMemo(() =>
    filter() === "managers" ? false : pagedLoader.hasError(filter() as PagedFilter),
  );

  const retryLoad = () => {
    const f = filter();
    if (f !== "managers") void loadMore(f);
  };
  const loadErrorLabel = createMemo(() => {
    if (filter() === "managers") return "channel managers";
    if (filter() === "apps") return "apps";
    return "members";
  });

  const filteredMembers = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = visibleMembers();
    if (!q) return list;
    return list.filter((u) => u.name.toLowerCase().includes(q));
  });

  initRovingTabIndexDefault(() => listRef, filteredMembers);

  const emptyLabel = createMemo(() => {
    if (query().trim()) return "No matches.";
    switch (filter()) {
      case "managers":
        return "No channel managers.";
      case "apps":
        return "No apps in this channel.";
      default:
        return "No members.";
    }
  });

  const addPerson = async (userId: string) => {
    if (inviting()) return;
    setAddingPeople(false);
    setInviting(true);
    try {
      if (await inviteUsersToChannel(props.channelId, [userId])) {
        const user = store.users.userById(userId);
        if (user) {
          setPagedMembers((prev) => ({
            ...prev,
            everyone: prev.everyone.some((u) => u.id === userId)
              ? prev.everyone
              : [user, ...prev.everyone],
          }));
        }
        props.onMembersChanged?.();
      }
    } finally {
      setInviting(false);
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
      <div class="channel-details-members-bar">
        <input
          class="channel-details-input"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Find members"
          type="text"
          value={query()}
        />
        <Tooltip content="Copy members">
          <button
            class="channel-details-add-btn btn-reset flex-center"
            disabled={filteredMembers().length === 0}
            onClick={() =>
              void copy(
                filteredMembers()
                  .map((u) => `<@${u.id}>`)
                  .join(" "),
                "members",
              )
            }
            type="button"
          >
            <Icon name={copiedKey() === "members" ? "check" : "copy"} size={15} />
          </button>
        </Tooltip>
        <Show when={filter() === "everyone"}>
          <button
            class="channel-details-add-btn btn-reset flex-align-center"
            disabled={inviting()}
            onClick={() => setAddingPeople(true)}
            type="button"
          >
            <Icon name="user-add" size={15} /> {inviting() ? "Adding…" : "Add people"}
          </button>
        </Show>
      </div>
      <Show when={addingPeople()}>
        <div class="channel-details-picker">
          <ComposeUserPicker
            excludeUserIds={pagedMembers().everyone.map((user) => user.id)}
            onClose={() => setAddingPeople(false)}
            onSelect={addPerson}
          />
        </div>
      </Show>
      <Show when={loadError()}>
        <div class="channel-details-members-error">
          <span>Couldn't load {loadErrorLabel()}.</span>
          <Button disabled={isLoading()} onClick={retryLoad} size="sm">
            Try again
          </Button>
        </div>
      </Show>
      <div class="channel-details-member-list flex-col" ref={listRef}>
        <For
          each={filteredMembers()}
          fallback={
            <Show when={!(isLoading() || loadError())}>
              <p class="channel-details-empty">{emptyLabel()}</p>
            </Show>
          }
        >
          {(u) => (
            <div class="channel-details-member flex-align-center">
              <button
                class="channel-details-member-main btn-reset flex-align-center"
                data-nav-row
                onClick={() => store.users.openUserProfile(u.id)}
                tabIndex={-1}
                type="button"
              >
                <Avatar size="small" user={u} />
                <span class="channel-details-member-name truncate">{u.name}</span>
                <Show when={managerIds().includes(u.id)}>
                  <span class="channel-details-member-badge">Manager</span>
                </Show>
                <Show when={u.isBot}>
                  <span class="channel-details-member-badge">APP</span>
                </Show>
              </button>
              <Show when={u.id !== store.users.currentUser()?.id}>
                <Tooltip content="Remove from channel">
                  <button
                    class="channel-details-member-remove btn-reset flex-center"
                    disabled={removingMemberIds().has(u.id)}
                    onClick={() => removeMember(u)}
                    type="button"
                  >
                    <Icon name="close-filled" size={14} />
                  </button>
                </Tooltip>
              </Show>
            </div>
          )}
        </For>
        <Show when={isLoading()}>
          <div class="channel-details-member-placeholder">Loading…</div>
        </Show>
        <Show
          when={
            filter() !== "managers" &&
            pagedCursors()[filter() as PagedFilter] &&
            !isLoading() &&
            !loadError()
          }
        >
          <button
            class="channel-details-show-more btn-reset"
            onClick={() => loadMore(filter() as PagedFilter)}
            type="button"
          >
            Show more
          </button>
        </Show>
      </div>
    </>
  );
}
