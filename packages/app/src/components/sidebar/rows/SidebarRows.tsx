// biome-ignore-all lint/style/useFilenamingConvention: This module intentionally groups the related DM row and sidebar skeleton exports.
import type { DirectMessage } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon, InlineFeedback, Skeleton, Tooltip } from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { actionFeedback, dmDisplayName, store } from "../../../lib/store";

export function DmRow(props: { dm: DirectMessage }) {
  const user = createMemo(() =>
    props.dm.userId ? store.users.userById(props.dm.userId) : undefined,
  );
  const members = createMemo(() =>
    (props.dm.memberIds ?? []).map((id) => store.users.userById(id)).filter((u) => u !== undefined),
  );
  const name = createMemo(() => dmDisplayName(props.dm, store.users.userById));
  // A DM is only ready to render once every participant it needs has
  // resolved — an mpdm with none of its members loaded yet would otherwise
  // flash as an empty row.
  const ready = createMemo(() => (props.dm.userId ? !!user() : members().length > 0));
  const isActive = createMemo(() => {
    const v = store.viewState.activeView();
    return store.viewState.nav() === "home" && v?.kind === "dm" && v.id === props.dm.id;
  });

  return (
    <Show when={ready()}>
      <div class="sidebar-row-wrap">
        <button
          class="sidebar-row btn-reset flex-align-center"
          classList={{ active: isActive(), unread: !!store.unread.unreadChannelIds[props.dm.id] }}
          onClick={() => store.viewState.setActiveView({ id: props.dm.id, kind: "dm" })}
          type="button"
        >
          <Show fallback={<AvatarStack size="small" users={members()} />} when={user()}>
            {(u) => <Avatar showPresence size="small" user={u()} />}
          </Show>
          <span class="sidebar-row-name truncate">{name()}</span>
          {props.dm.mentions ? <span class="sidebar-badge">{props.dm.mentions}</span> : null}
        </button>
        <Tooltip content="Close conversation">
          <button
            aria-label="Close conversation"
            class="sidebar-row-close btn-reset flex-center text-muted"
            onClick={(e) => {
              e.stopPropagation();
              void store.dms.closeDmConversation(props.dm.id);
            }}
            type="button"
          >
            <Icon name="close" size={12} />
          </button>
        </Tooltip>
        <InlineFeedback class="sidebar-row-feedback" feedback={actionFeedback.get(props.dm.id)} />
      </div>
    </Show>
  );
}

const SKELETON_ROW_WIDTHS = [120, 88, 150, 100, 70, 130, 95];

export function SidebarSkeleton() {
  return (
    <div aria-hidden="true" class="sidebar-section">
      <div class="sidebar-section-header flex-align-center">
        <Skeleton height={11} width={64} />
      </div>
      <For each={SKELETON_ROW_WIDTHS}>
        {(w) => (
          <div class="sidebar-row flex-align-center">
            <Skeleton height={12} radius={3} width={16} />
            <Skeleton height={12} width={w} />
          </div>
        )}
      </For>
    </div>
  );
}
