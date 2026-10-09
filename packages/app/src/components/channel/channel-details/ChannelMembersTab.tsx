import type { User } from "@slock/types";
import {
  Avatar,
  Button,
  createCopyFeedback,
  IconButton,
  initRovingTabIndexDefault,
  SegmentedControl,
} from "@slock/ui";
import { For, type JSX, Show } from "solid-js";
import { actionFeedback } from "../../../lib/feedback";
import { store } from "../../../lib/store";
import type { MemberFilter } from "../lib/channelDetails";
import { createChannelMembers } from "../lib/channelMembers";
import "./ChannelDetails.css";
import "./ChannelMembersTab.css";

const MEMBER_FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "everyone", label: "Everyone" },
  { key: "managers", label: "Channel managers" },
  { key: "apps", label: "Apps" },
];

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
  memberCount?: number;
  onMembersChanged?: () => void;
}) {
  let listRef: HTMLDivElement | undefined;
  const members = createChannelMembers({
    channelId: () => props.channelId,
    channelName: () => props.channelName,
    memberCount: () => props.memberCount,
    onMembersChanged: props.onMembersChanged,
  });
  const [copiedKey, copy] = createCopyFeedback(1200, () =>
    actionFeedback.flash(props.channelId, "Couldn't copy the member list.", "error"),
  );
  initRovingTabIndexDefault(
    () => listRef,
    () => [...members.filteredMembers(), ...members.nonMembers()],
  );

  return (
    <>
      <div class="channel-details-members-toolbar flex-align-center">
        <SegmentedControl class="channel-details-member-filter">
          <For each={MEMBER_FILTERS}>
            {(f) => (
              <button
                class="segmented-control-btn"
                classList={{ active: members.filter() === f.key }}
                onClick={() => members.setFilter(f.key)}
                type="button"
              >
                {f.label}
                <Show when={members.filterCount(f.key) !== undefined}>
                  <span class="channel-details-filter-count">{members.filterCount(f.key)}</span>
                </Show>
              </button>
            )}
          </For>
        </SegmentedControl>
        <IconButton
          class="channel-details-copy-btn"
          disabled={members.filteredMembers().length === 0}
          icon={copiedKey() === "members" ? "check" : "copy"}
          iconSize={15}
          label="Copy members"
          onClick={() =>
            void copy(
              members
                .filteredMembers()
                .map((u) => `<@${u.id}>`)
                .join(" "),
              "members",
            )
          }
        />
      </div>
      <input
        class="text-field"
        onInput={(e) => members.setQuery(e.currentTarget.value)}
        placeholder="Find members"
        type="text"
        value={members.query()}
      />
      <Show when={members.loadError()}>
        <div class="channel-details-members-error flex-center gap-sm">
          <span>Couldn't load {members.loadErrorLabel()}.</span>
          <Button disabled={members.isLoading()} onClick={members.retryLoad} size="sm">
            Try again
          </Button>
        </div>
      </Show>
      <div
        class="channel-details-member-list flex-col"
        onScroll={(e) => members.loadMoreAtBottom(e.currentTarget)}
        ref={listRef}
      >
        <For each={members.filteredMembers()}>
          {(u) => (
            <MemberRow
              action={
                <Show when={u.id !== store.users.currentUser()?.id}>
                  <IconButton
                    class="channel-details-member-remove busy"
                    disabled={members.isRemoving(u.id)}
                    icon="close-filled"
                    iconSize={14}
                    label="Remove from channel"
                    onClick={() => members.removeMember(u)}
                  />
                </Show>
              }
              isManager={members.isManager(u.id)}
              user={u}
            />
          )}
        </For>
        <Show when={members.nonMembers().length > 0}>
          <div class="channel-details-member-divider">Not in this channel</div>
          <For each={members.nonMembers()}>
            {(u) => (
              <MemberRow
                action={
                  <IconButton
                    class="channel-details-member-add busy"
                    disabled={members.isAdding(u.id)}
                    icon="user-add"
                    iconSize={14}
                    label="Add to channel"
                    onClick={() => members.addPerson(u)}
                  />
                }
                isManager={false}
                user={u}
              />
            )}
          </For>
        </Show>
        <Show when={members.showEmpty()}>
          <p class="channel-details-empty">{members.emptyLabel()}</p>
        </Show>
        <Show when={members.isLoading()}>
          <div class="channel-details-member-placeholder">Loading…</div>
        </Show>
        <Show when={members.showSearching()}>
          <div class="channel-details-member-placeholder">Searching…</div>
        </Show>
      </div>
    </>
  );
}
