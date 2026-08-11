import type { ChannelMembersPage, User } from "@slock/slack-api";
import { Avatar, Button, createCopyFeedback, Icon, SegmentedControl, Tooltip } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import {
  inviteUsersToChannel,
  loadChannelManagerIds,
  loadChannelMembers,
  type MemberFilter,
  removeUserFromChannel,
} from "../../../lib/channelDetails";
import { actionFeedback, store } from "../../../lib/store";
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
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<MemberFilter>("everyone");
  // Kept per-filter (rather than one shared list) so switching Everyone ->
  // Apps -> Everyone shows what was already loaded instead of wiping it.
  const [pagedMembers, setPagedMembers] = createSignal<Record<PagedFilter, User[]>>({
    apps: [],
    everyone: [],
  });
  const [pagedCursors, setPagedCursors] = createSignal<Record<PagedFilter, string | undefined>>({
    apps: undefined,
    everyone: undefined,
  });
  const [pagedLoadVersion, setPagedLoadVersion] = createSignal(0);

  // Channel managers come from a completely different, non-paginated
  // endpoint (admin.roles.entity.listAssignments — see fetchChannelManagerIds)
  // that only returns ids, so they're resolved through the store's user
  // lookup rather than sharing the `pagedMembers` cache the edge API fills in.
  // That endpoint is Enterprise Grid-only and errors on every normal
  // workspace — treated as "no managers assigned" rather than a load
  // failure, since there's nothing a retry could fix there.
  const [managerIds, setManagerIds] = createSignal<string[]>([]);
  const [loadingManagers, setLoadingManagers] = createSignal(false);
  let managersLoaded = false;

  const [copiedKey, copy] = createCopyFeedback(1200, () =>
    actionFeedback.flash(props.channelId, "Couldn’t copy the member list.", "error"),
  );

  const [addingPeople, setAddingPeople] = createSignal(false);
  const [inviting, setInviting] = createSignal(false);
  const [removingMemberIds, setRemovingMemberIds] = createSignal<Set<string>>(new Set());

  // Switching between Everyone/Apps queries the same edge endpoint with a
  // different `filter` param. Results always land in that filter's own slot
  // (not "whichever filter is selected right now"), so a fetch that's still
  // in flight when the user switches away doesn't get dropped.
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
    onStateChange: () => setPagedLoadVersion((version) => version + 1),
  });
  const loadMore = (f: PagedFilter) => pagedLoader.load(f);
  const isPagedLoading = (f: PagedFilter) => {
    pagedLoadVersion();
    return pagedLoader.isLoading(f);
  };
  const hasPagedLoadError = (f: PagedFilter) => {
    pagedLoadVersion();
    return pagedLoader.hasError(f);
  };

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
    filter() === "managers" ? loadingManagers() : isPagedLoading(filter() as PagedFilter),
  );
  const loadError = createMemo(() =>
    filter() === "managers" ? false : hasPagedLoadError(filter() as PagedFilter),
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
    // biome-ignore lint/suspicious/noAlert: Removing a member requires explicit confirmation.
    if (!confirm(`Remove ${user.name} from #${props.channelName}?`)) return;
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
              aria-pressed={filter() === f.key}
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
            aria-label="Copy members"
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
        <div class="channel-details-members-error" role="alert">
          <span>Couldn’t load {loadErrorLabel()}.</span>
          <Button disabled={isLoading()} onClick={retryLoad} size="sm">
            Try again
          </Button>
        </div>
      </Show>
      <div class="channel-details-member-list flex-col">
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
                    aria-label="Remove from channel"
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
