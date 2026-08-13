import type { DirectMessage } from "@slock/slack-api";
import {
  Avatar,
  AvatarStack,
  Icon,
  type IconName,
  InlineFeedback,
  Skeleton,
  Tooltip,
} from "@slock/ui";
import type { JSX } from "solid-js";
import { createMemo, For, Show } from "solid-js";
import { actionFeedback, dmDisplayName, store } from "../../../lib/store";
import { openConversationInSplit, SplitNavigation } from "../../navigation/SplitNavigation";

export function SidebarSectionCaretRow(props: {
  badge?: JSX.Element;
  caretIcon?: IconName;
  caretSize?: number;
  label: string;
  labelAriaLabel?: string;
  onLabelClick?: () => void;
  onToggleOpen: () => void;
  open: boolean;
}) {
  return (
    <div class="sidebar-section-header-btn flex-align-center text-muted text-sm">
      <button
        aria-expanded={props.open}
        aria-label={`${props.open ? "Collapse" : "Expand"} ${props.label}`}
        class="sidebar-caret btn-reset"
        onClick={props.onToggleOpen}
        type="button"
      >
        <Icon
          name={props.caretIcon ?? (props.open ? "caret-down-filled" : "caret-right-filled")}
          size={props.caretSize ?? 12}
        />
      </button>
      <Show fallback={<span>{props.label}</span>} when={props.onLabelClick}>
        {(onLabelClick) => (
          <button
            aria-label={props.labelAriaLabel}
            class="btn-reset text-muted text-sm"
            onClick={onLabelClick()}
            type="button"
          >
            {props.label}
          </button>
        )}
      </Show>
      {props.badge}
    </div>
  );
}

export function DmRow(props: { dm: DirectMessage }) {
  const user = createMemo(() =>
    props.dm.userId ? store.users.userById(props.dm.userId) : undefined,
  );
  const members = createMemo(() =>
    (props.dm.memberIds ?? []).map((id) => store.users.userById(id)).filter((u) => u !== undefined),
  );
  const name = createMemo(() => dmDisplayName(props.dm, store.users.userById));

  const ready = createMemo(() => (props.dm.userId ? !!user() : members().length > 0));
  const isActive = createMemo(() => {
    const v = store.viewState.activeView();
    return store.viewState.nav() === "home" && v?.kind === "dm" && v.id === props.dm.id;
  });
  const muted = createMemo(() => store.preferences.isChannelMuted(props.dm.id));

  return (
    <Show when={ready()}>
      <div class="sidebar-row-wrap">
        <SplitNavigation onSplit={() => openConversationInSplit(props.dm.id)}>
          <button
            class="sidebar-row btn-reset flex-align-center"
            classList={{
              active: isActive(),
              muted: muted(),
              unread: !!store.unread.unreadChannelIds[props.dm.id] && !muted(),
            }}
            data-nav-row
            onClick={() => store.viewState.setActiveView({ id: props.dm.id, kind: "dm" })}
            type="button"
          >
            <Show fallback={<AvatarStack max={3} size="small" users={members()} />} when={user()}>
              {(u) => <Avatar showPresence size="small" user={u()} />}
            </Show>
            <span class="sidebar-row-name truncate">{name()}</span>
            {!muted() && props.dm.mentions ? (
              <span class="sidebar-badge">{props.dm.mentions}</span>
            ) : null}
          </button>
        </SplitNavigation>
        <Tooltip content="Close conversation">
          <button
            aria-label="Close conversation"
            class="sidebar-row-close btn-reset flex-center text-muted"
            disabled={store.dms.isCloseDmPending(props.dm.id)}
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
