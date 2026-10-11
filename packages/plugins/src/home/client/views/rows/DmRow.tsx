import { Slot, service } from "@slock/core/solid";
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
import { openConversationInSplit } from "../../../../conversations/client/api/nav";
import { channelHasDraft } from "../../../../drafts/client/api";
import { SplitNavigation } from "../../../../shell/client/api/SplitNavigation";
import { unreadSummary } from "../lib/unreadSummary";
import DraftList from "./DraftList";
import "./SidebarRow.css";

const feedback = service("feedback");

const sidebarStore = service("sidebar");

const viewStore = service("conversations");
const conversationsStore = service("conversations");
const unreadStore = service("unread");
const dmsStore = service("dms");
const titles = service("titles");
const usersStore = service("users");
const messagesStore = service("messages");
const prefsStore = service("prefs");

export function DmRow(props: { dm: DirectMessage }) {
  const user = createMemo(() =>
    props.dm.userId ? usersStore.userById(props.dm.userId) : undefined,
  );
  const members = createMemo(() =>
    (props.dm.memberIds ?? []).map((id) => usersStore.userById(id)).filter((u) => u !== undefined),
  );
  const name = createMemo(() => titles.title(props.dm.id));

  const ready = createMemo(() => (props.dm.userId ? !!user() : members().length > 0));
  const isActive = createMemo(
    () => sidebarStore.nav() === "home" && conversationsStore.isOpenInAnyPane(props.dm.id, "dm"),
  );
  const muted = createMemo(() => prefsStore.isChannelMuted(props.dm.id));
  const hasDraft = createMemo(() => channelHasDraft(props.dm.id));
  const ctxMenu = useContextMenu();
  const unreadTooltip = createMemo(() =>
    unreadSummary({
      currentUserId: usersStore.currentUser()?.id,
      lastRead: unreadStore.lastReadFor(props.dm.id),
      loadedMessages: messagesStore.messagesInChannel(props.dm.id),
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
              unread: unreadStore.isChannelUnread(props.dm.id) && !muted(),
            }}
            data-channel-id={props.dm.id}
            data-nav-row
            onClick={() => viewStore.setActiveView({ id: props.dm.id, kind: "dm" })}
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
          class="sidebar-row-close hover-hl"
          disabled={dmsStore.isCloseDmPending(props.dm.id)}
          icon="close"
          iconSize={12}
          label="Close conversation"
          onClick={(e) => {
            e.stopPropagation();
            void dmsStore.closeDmConversation(props.dm.id);
          }}
        />
        <InlineFeedback class="sidebar-row-feedback" feedback={feedback.get(props.dm.id)} />
      </div>
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <Slot
          channelId={props.dm.id}
          channelTitle={name()}
          close={ctxMenu.close}
          isDm
          point="messages.channelMenu"
          showMoveTo={false}
        />
      </ContextMenu>
    </Show>
  );
}
