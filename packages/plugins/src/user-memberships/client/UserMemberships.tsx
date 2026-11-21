import { service } from "@slock/core/solid";
import type { ProfileMetaProps } from "@slock/plugins/profile/client/api";
import { defineQuery } from "@slock/plugins/query/client/api";
import { isChannelId } from "@slock/slack";
import type { UserId } from "@slock/types";
import { Button, SegmentedControl } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  fetchMemberships,
  MEMBERSHIPS_STALE_MS,
  type Membership,
  type MembershipKind,
} from "./fetch";
import "./UserMemberships.css";

const PAGE_SIZE = 20;

const FILTERS: { label: string; kinds: MembershipKind[] }[] = [
  { kinds: ["public"], label: "Public" },
  { kinds: ["private"], label: "Private" },
  { kinds: ["mpim", "im"], label: "DMs" },
];

const membershipsQuery = defineQuery<UserId, Membership[]>({
  load: fetchMemberships,
  maxAgeMs: MEMBERSHIPS_STALE_MS,
  name: "memberships",
});

const conversations = service("conversations");
const users = service("users");

function labelOf(membership: Membership): string {
  if (membership.kind === "im" && membership.userId)
    return users.userById(membership.userId)?.name ?? "DM";
  if (membership.kind === "mpim")
    return membership.name.replace(/^mpdm-|-\d+$/g, "").replaceAll("--", ", ");
  return `#${membership.name}`;
}

export default function UserMemberships(props: ProfileMetaProps) {
  const [filterIndex, setFilterIndex] = createSignal(0);
  const [limit, setLimit] = createSignal(PAGE_SIZE);
  const memberships = membershipsQuery.state(() => (props.user.isBot ? undefined : props.user.id));
  const visible = createMemo(() => {
    const kinds = FILTERS[filterIndex()]?.kinds ?? [];
    return (memberships().data ?? []).filter((m) => kinds.includes(m.kind));
  });
  const select = (index: number) => {
    setFilterIndex(index);
    setLimit(PAGE_SIZE);
  };
  return (
    <Show when={memberships().data?.length}>
      <div class="user-profile-section">
        <h3 class="user-profile-section-title">Conversations ({memberships().data?.length})</h3>
        <SegmentedControl class="user-memberships-filter">
          <For each={FILTERS}>
            {(filter, index) => (
              <button
                class={["segmented-control-btn", { active: filterIndex() === index() }]}
                onClick={() => select(index())}
                type="button"
              >
                {filter.label}
              </button>
            )}
          </For>
        </SegmentedControl>
        <ul class="user-memberships flex-col">
          <For each={visible().slice(0, limit())}>
            {(membership) => (
              <li>
                <button
                  class="user-membership btn-reset flex-align-center"
                  onClick={() => {
                    if (isChannelId(membership.id))
                      conversations.setActiveView(conversations.viewFor(membership.id));
                  }}
                  type="button"
                >
                  <span class="truncate">{labelOf(membership)}</span>
                  <Show when={membership.created}>
                    <span class="user-membership-badge text-muted text-sm">Creator</span>
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
        <Show when={visible().length > limit()}>
          <Button onClick={() => setLimit((current) => current + PAGE_SIZE)} size="sm">
            More
          </Button>
        </Show>
      </div>
    </Show>
  );
}
