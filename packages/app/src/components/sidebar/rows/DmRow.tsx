import type { DirectMessage } from "@slock/types";
import {
  Avatar,
  AvatarStack,
  ContextMenu,
  HoverCard,
  Icon,
  IconButton,
  InlineFeedback,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { dmDisplayName } from "../../../lib/displayName";
import { actionFeedback } from "../../../lib/feedback";
import { openConversationInSplit } from "../../../lib/navigation/conversationNav";
import { store } from "../../../lib/store";
import ChannelActionsMenuItems from "../../channel/ChannelActionsMenuItems";
import { channelHasDraft } from "../../composer/lib/drafts";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import { unreadSummary } from "../lib/unreadSummary";
import DraftList from "./DraftList";
import "./SidebarRow.css";

export function DmRow(props: { dm: DirectMessage }) {
  const user = createMemo(() =>
    props.dm.userId ? store.users.userById(props.dm.userId) : undefined,
  );
  const members = createMemo(() =>
    (props.dm.memberIds ?? []).map((id) => store.users.userById(id)).filter((u) => u !== undefined),
  );
  const name = createMemo(() => dmDisplayName(props.dm, store.users.userById));

  const ready = createMemo(() => (props.dm.userId ? !!user() : members().length > 0));
  const isActive = createMemo(
    () => store.viewState.nav() === "home" && store.panes.isOpenInAnyPane(props.dm.id, "dm"),
  );
  const muted = createMemo(() => store.preferences.isChannelMuted(props.dm.id));
  const hasDraft = createMemo(() => channelHasDraft(props.dm.id));
  const ctxMenu = useContextMenu();
  const unreadTooltip = createMemo(() =>
    unreadSummary({
      currentUserId: store.users.currentUser()?.id,
      lastRead: store.unread.lastReadFor(props.dm.id),
      loadedMessages: store.messages.messagesInChannel(props.dm.id),
      mentions: props.dm.mentions,
    }),
  );

  return (
    <Show when={ready()}>
      <div class="sidebar-row-wrap">
        <SplitNavigation onSplit={() => openConversationInSplit(props.dm.id)}>
          <button
            class="sidebar-row btn-reset flex-align-center"
            classList={{
              active: isActive(),
              muted: muted(),
              unread: store.unread.isChannelUnread(props.dm.id) && !muted(),
            }}
            data-channel-id={props.dm.id}
            data-nav-row
            onClick={() => store.viewState.setActiveView({ id: props.dm.id, kind: "dm" })}
            onContextMenu={ctxMenu.open}
            tabIndex={-1}
            type="button"
          >
            <Show fallback={<AvatarStack max={3} size="small" users={members()} />} when={user()}>
              {(u) => <Avatar showPresence size="small" user={u()} />}
            </Show>
            <span class="sidebar-row-name truncate">{name()}</span>
            <span class="sidebar-row-end">
              {hasDraft() ? (
                <HoverCard
                  align="start"
                  content={(close) => <DraftList channelId={props.dm.id} close={close} kind="dm" />}
                >
                  <span class="sidebar-row-draft flex-align-center">
                    <Icon name="edit" size={12} />
                  </span>
                </HoverCard>
              ) : null}
              {!muted() && props.dm.mentions ? (
                <Tooltip content={unreadTooltip()}>
                  <span class="sidebar-badge">{props.dm.mentions}</span>
                </Tooltip>
              ) : null}
            </span>
          </button>
        </SplitNavigation>
        <IconButton
          class="sidebar-row-close"
          disabled={store.dms.isCloseDmPending(props.dm.id)}
          icon="close"
          iconSize={12}
          label="Close conversation"
          onClick={(e) => {
            e.stopPropagation();
            void store.dms.closeDmConversation(props.dm.id);
          }}
        />
        <InlineFeedback class="sidebar-row-feedback" feedback={actionFeedback.get(props.dm.id)} />
      </div>
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <ChannelActionsMenuItems
          channelId={props.dm.id}
          channelTitle={name()}
          isDm
          onClose={ctxMenu.close}
        />
      </ContextMenu>
    </Show>
  );
}
