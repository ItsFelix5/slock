import type { User } from "@slock/slack-api";
import { Avatar, Icon, SegmentedControl, showToast } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  inviteUsersToChannel,
  loadChannelManagerIds,
  loadChannelMembers,
  type MemberFilter,
  removeUserFromChannel,
} from "../../../lib/channelDetails";
import { currentUser, openUserProfile, userById } from "../../../lib/store";
import ComposeUserPicker from "../../composer/ComposeUserPicker";
import "./ChannelDetails.css";

type PagedFilter = "everyone" | "apps";

const MEMBER_FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "everyone", label: "Everyone" },
  { key: "managers", label: "Channel managers" },
  { key: "apps", label: "Apps" },
];

export default function ChannelMembersTab(props: { channelId: string; channelName: string }) {
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<MemberFilter>("everyone");
  // Kept per-filter (rather than one shared list) so switching Everyone ->
  // Apps -> Everyone shows what was already loaded instead of wiping it.
  const [pagedMembers, setPagedMembers] = createSignal<Record<PagedFilter, User[]>>({
    everyone: [],
    apps: [],
  });
  const [pagedCursors, setPagedCursors] = createSignal<Record<PagedFilter, string | undefined>>({
    everyone: undefined,
    apps: undefined,
  });
  const [loadingMembers, setLoadingMembers] = createSignal(false);
  const loadedPagedFilters = new Set<PagedFilter>();

  // Channel managers come from a completely different, non-paginated
  // endpoint (admin.roles.entity.listAssignments — see fetchChannelManagerIds)
  // that only returns ids, so they're resolved through the store's user
  // lookup rather than sharing the `pagedMembers` cache the edge API fills in.
  const [managerIds, setManagerIds] = createSignal<string[]>([]);
  const [loadingManagers, setLoadingManagers] = createSignal(false);
  let managersLoaded = false;

  const [addingPeople, setAddingPeople] = createSignal(false);

  // Switching between Everyone/Apps queries the same edge endpoint with a
  // different `filter` param. Results always land in that filter's own slot
  // (not "whichever filter is selected right now"), so a fetch that's still
  // in flight when the user switches away doesn't get dropped.
  const loadMore = async (f: PagedFilter) => {
    if (loadingMembers()) return;
    setLoadingMembers(true);
    const page = await loadChannelMembers(props.channelId, f, pagedCursors()[f]);
    const known = new Set(pagedMembers()[f].map((u) => u.id));
    setPagedMembers((prev) => ({
      ...prev,
      [f]: [...prev[f], ...page.members.filter((u) => !known.has(u.id))],
    }));
    setPagedCursors((prev) => ({ ...prev, [f]: page.nextCursor }));
    setLoadingMembers(false);
  };

  const loadManagers = async () => {
    if (managersLoaded || loadingManagers()) return;
    managersLoaded = true;
    setLoadingManagers(true);
    setManagerIds(await loadChannelManagerIds(props.channelId));
    setLoadingManagers(false);
  };

  createEffect(() => {
    const f = filter();
    if (f === "managers") {
      loadManagers();
      return;
    }
    if (loadedPagedFilters.has(f)) return;
    loadedPagedFilters.add(f);
    loadMore(f);
  });

  const resolvedManagers = createMemo(() =>
    managerIds()
      .map((id) => userById(id))
      .filter((u): u is User => !!u),
  );

  const visibleMembers = createMemo(() => {
    const f = filter();
    return f === "managers" ? resolvedManagers() : pagedMembers()[f];
  });

  const isLoading = createMemo(() =>
    filter() === "managers" ? loadingManagers() : loadingMembers(),
  );

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
    setAddingPeople(false);
    if (await inviteUsersToChannel(props.channelId, [userId])) {
      const user = userById(userId);
      if (user) {
        setPagedMembers((prev) => ({
          ...prev,
          everyone: prev.everyone.some((u) => u.id === userId)
            ? prev.everyone
            : [user, ...prev.everyone],
        }));
      }
      showToast(`Added ${user?.name ?? "user"} to the channel.`);
    }
  };

  const removeMember = async (user: User) => {
    if (!confirm(`Remove ${user.name} from #${props.channelName}?`)) return;
    if (await removeUserFromChannel(props.channelId, user.id)) {
      setPagedMembers((prev) => ({
        everyone: prev.everyone.filter((u) => u.id !== user.id),
        apps: prev.apps.filter((u) => u.id !== user.id),
      }));
      setManagerIds((prev) => prev.filter((id) => id !== user.id));
      showToast(`Removed ${user.name}.`);
    }
  };

  return (
    <>
      <SegmentedControl class="channel-details-member-filter">
        <For each={MEMBER_FILTERS}>
          {(f) => (
            <button
              type="button"
              class="segmented-control-btn"
              classList={{ active: filter() === f.key }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          )}
        </For>
      </SegmentedControl>
      <div class="channel-details-members-bar">
        <input
          class="channel-details-input"
          type="text"
          placeholder="Find members"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <Show when={filter() === "everyone"}>
          <button
            type="button"
            class="channel-details-add-btn"
            onClick={() => setAddingPeople(true)}
          >
            <Icon name="user-add" size={15} /> Add people
          </button>
        </Show>
      </div>
      <Show when={addingPeople()}>
        <div class="channel-details-picker">
          <ComposeUserPicker onSelect={addPerson} onClose={() => setAddingPeople(false)} />
        </div>
      </Show>
      <div class="channel-details-member-list">
        <For
          each={filteredMembers()}
          fallback={
            <Show when={!isLoading()}>
              <p class="channel-details-empty">{emptyLabel()}</p>
            </Show>
          }
        >
          {(u) => (
            <div class="channel-details-member">
              <button
                type="button"
                class="channel-details-member-main"
                onClick={() => openUserProfile(u.id)}
              >
                <Avatar user={u} size="small" />
                <span class="channel-details-member-name">{u.name}</span>
                <Show when={u.isBot}>
                  <span class="channel-details-member-badge">APP</span>
                </Show>
                <Show when={u.title}>
                  <span class="channel-details-member-title">{u.title}</span>
                </Show>
              </button>
              <Show when={u.id !== currentUser()?.id}>
                <button
                  type="button"
                  class="channel-details-member-remove"
                  title="Remove from channel"
                  onClick={() => removeMember(u)}
                >
                  <Icon name="close-filled" size={14} />
                </button>
              </Show>
            </div>
          )}
        </For>
        <Show when={isLoading()}>
          <div class="channel-details-member-placeholder">Loading…</div>
        </Show>
        <Show
          when={filter() !== "managers" && pagedCursors()[filter() as PagedFilter] && !isLoading()}
        >
          <button
            type="button"
            class="channel-details-show-more"
            onClick={() => loadMore(filter() as PagedFilter)}
          >
            Show more
          </button>
        </Show>
      </div>
    </>
  );
}
