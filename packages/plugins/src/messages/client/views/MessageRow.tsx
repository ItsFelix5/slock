import { maybeService, Slot, service } from "@slock/core/solid";
import type { ChannelId, Message, Ts } from "@slock/types";
import { ContextMenu, useContextMenu, useDeferredMount } from "@slock/ui";
import { createEffect, createMemo, Show } from "solid-js";
import { retainsDeleted } from "../api/deletedMessages";
import type { OpenThreadHandler } from "../api/messageFocus";
import { isMessageBackgroundContextMenu } from "../messageContextMenuTarget";
import "./MessageList.css";
import MessageActionsMenuItems from "../api/cards/MessageActionsMenuItems";
import ReplyReferenceRow from "../api/cards/ReplyReferenceRow";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveBotProfileUserId,
  resolveProfileUserId,
} from "../api/messageAuthor";
import { resolveMessageContent, resolveMessageNeighbors } from "../lib/messageRenderState";
import { createRowEngagement } from "./createRowEngagement";
import MessageMeta from "./MessageMeta";
import MessageActionsBar from "./parts/MessageActionsBar";
import MessageRowAvatar from "./parts/MessageRowAvatar";
import MessageTextContent from "./parts/MessageTextContent";
import { MessageDayDivider, RepliesDivider } from "./parts/messageDividers";
import SystemMessageContent from "./parts/SystemMessageContent";

const unreadStore = service("unread");
const usersStore = service("users");
const messagesStore = service("messages");

const pinned = maybeService("pins");

const later = maybeService("later");

export type MessageRowProps = {
  message: Message;
  messages: Message[];
  prev: () => Message | undefined;
  messageByTs: () => Map<Ts, Message>;
  channelId: ChannelId;
  threadTs?: Ts;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: Ts) => void;
  index: () => number;
  focusedTs?: () => Ts | null;
  editingTs?: () => Ts | null;
  onStartEdit?: (ts: Ts) => void;
  onStopEdit?: () => void;
  reactionPickerTs?: () => Ts | null;
  onToggleReactionPicker?: (ts: Ts) => void;
  moreMenuTs?: () => Ts | null;
  onToggleMoreMenu?: (ts: Ts) => void;
};

export default function MessageRow(props: MessageRowProps) {
  const msg = () => props.message;
  const isPinned = () => !!pinned()?.isMessagePinned(props.channelId, msg().ts);
  const content = createMemo(() =>
    resolveMessageContent(msg(), {
      channelId: props.channelId,
      hasOpenThread: !!props.onOpenThread,
      messages: () => props.messages,
      threadTs: props.threadTs,
    }),
  );
  const neighbors = createMemo(() =>
    resolveMessageNeighbors(msg(), props.prev(), content(), {
      channelId: props.channelId,
      isPinned: isPinned(),
      messages: () => props.messages,
      showDeleted: retainsDeleted(msg()),
      threadTs: props.threadTs,
      unreadDividerTs: unreadStore.unreadDividerTsForChannel(props.channelId),
    }),
  );
  const dayChanged = () => neighbors().dayChanged;
  const showUnreadDivider = () => neighbors().showUnreadDivider;
  const showRepliesDivider = () => neighbors().showRepliesDivider;
  const replyRef = () => content().replyRef;
  const messageText = () => content().messageText;
  const renderBlocks = () => content().renderBlocks;
  const hasEnlargedEmojiOnlyText = () => content().hasEnlargedEmojiOnlyText;
  const referencedMessage = createMemo(() => {
    const ref = replyRef();
    if (!ref) return;
    return (
      props.messageByTs().get(ref.ts) ??
      messagesStore
        .findAllMessageLocations(ref.channelId, ref.ts)[0]
        ?.list.find((m) => m.ts === ref.ts)
    );
  });
  const replyUnfurl = createMemo(() => {
    const ref = replyRef();
    return ref ? msg().attachments?.find((a) => a.isMessageUnfurl && a.ts === ref.ts) : undefined;
  });
  const showThreadContext = () => content().showThreadContext;
  const threadParent = createMemo(() => {
    const rootTs = msg().threadTs;
    if (!(showThreadContext() && rootTs)) return;
    return (
      msg().threadRoot ??
      props.messageByTs().get(rootTs) ??
      messagesStore
        .findAllMessageLocations(props.channelId, rootTs)[0]
        ?.list.find((m) => m.ts === rootTs)
    );
  });
  const visibleAttachments = () => content().visibleAttachments;
  const sameAuthorAsPrev = () => neighbors().sameAuthorAsPrev;
  const showBroadcastBadge = () => content().showBroadcastBadge;
  const profileUserId = () => resolveProfileUserId(msg());
  const botProfileUserId = () => resolveBotProfileUserId(msg());
  const user = createMemo(() => {
    const id = profileUserId();
    return id ? usersStore.userById(id) : undefined;
  });
  const displayName = () => resolveAuthorDisplayName(msg(), user()?.name, "Unknown");
  const avatarUrl = () => resolveAuthorAvatarUrl(msg(), user()?.avatarUrl);
  const isEditing = () => props.editingTs?.() === msg().ts;
  const focused = () => props.focusedTs?.() === msg().ts;
  const ctxMenu = useContextMenu();
  const deferred = useDeferredMount();
  createEffect(
    () => isEditing() || focused(),
    (needsContent) => {
      if (needsContent) deferred.now();
    },
  );

  const saved = () => !!later()?.isSavedForLater(props.channelId, msg().ts);
  const { engaged, events: rowEvents, keyboardFocus } = createRowEngagement();
  const isSystem = () => msg().kind === "system";
  const showActions = () =>
    !isSystem() &&
    (engaged() ||
      focused() ||
      props.reactionPickerTs?.() === msg().ts ||
      props.moreMenuTs?.() === msg().ts);

  return (
    <Show when={neighbors().showMessage}>
      <MessageDayDivider day={msg().day} dayChanged={dayChanged()} unread={showUnreadDivider()} />
      <div
        class={[
          "message-row-group",
          {
            compact: sameAuthorAsPrev(),
            deleted: msg().deleted,
            ephemeral: msg().isEphemeral,
            "has-actions": showActions(),
            "is-first-message": props.index() === 0,
            "kb-row": keyboardFocus() === "row",
            "kb-within": keyboardFocus() === "within",
            pending: msg().pending,
            saved: saved(),
            system: isSystem(),
          },
        ]}
      >
        <Show when={replyRef()}>
          {(ref) => (
            <ReplyReferenceRow
              attachment={replyUnfurl()}
              message={referencedMessage()}
              onJump={() => props.onJumpToMessage?.(ref().ts)}
              permalink={ref().url}
            />
          )}
        </Show>
        <Show when={showThreadContext() && msg().threadTs}>
          {(threadTs) => (
            <ReplyReferenceRow
              icon="threads"
              message={threadParent()}
              onJump={() => props.onOpenThread?.(threadTs())}
            />
          )}
        </Show>
        <div
          class="message-row"
          data-message-ts={msg().ts}
          {...rowEvents}
          onContextMenu={(e) => {
            if (isEditing()) return;
            if (!isMessageBackgroundContextMenu(e)) return;
            ctxMenu.open(e);
          }}
          tabindex={focused() ? 0 : -1}
        >
          <Show when={showActions()}>
            <MessageActionsBar
              channelId={props.channelId}
              moreMenuTs={() => props.moreMenuTs?.() ?? null}
              msg={msg()}
              onEditRequest={() => props.onStartEdit?.(msg().ts)}
              onOpenThread={props.onOpenThread}
              onReplyLink={props.onReplyLink}
              onToggleMoreMenu={(ts) => props.onToggleMoreMenu?.(ts)}
              onToggleReactionPicker={(ts) => props.onToggleReactionPicker?.(ts)}
              reactionPickerTs={() => props.reactionPickerTs?.() ?? null}
              rowFocused={focused}
              threadTs={props.threadTs}
            />
            <Show when={ctxMenu.isOpen()}>
              <ContextMenu onClose={ctxMenu.close} open x={ctxMenu.x()} y={ctxMenu.y()}>
                <MessageActionsMenuItems
                  channelId={props.channelId}
                  msg={msg()}
                  onClose={ctxMenu.close}
                  onEditRequest={() => props.onStartEdit?.(msg().ts)}
                  threadTs={props.threadTs}
                />
              </ContextMenu>
            </Show>
          </Show>
          <Show fallback={<SystemMessageContent msg={msg()} />} when={!isSystem()}>
            <Show fallback={<div class="message-avatar-spacer" />} when={!sameAuthorAsPrev()}>
              <MessageRowAvatar
                avatarUrl={avatarUrl()}
                displayName={displayName()}
                fallbackUserId={msg().userId}
                focused={focused()}
                profileUserId={profileUserId()}
                user={user()}
              />
            </Show>
            <div class="message-body" ref={deferred.ref}>
              <Show when={!sameAuthorAsPrev()}>
                <MessageMeta
                  channelId={props.channelId}
                  displayName={displayName}
                  threadTs={props.threadTs}
                  botUserId={botProfileUserId()}
                  onOpenBot={() => {
                    const id = botProfileUserId();
                    if (id) usersStore.openUserProfile(id);
                  }}
                  showBroadcastBadge={showBroadcastBadge}
                  tabbable={focused}
                  message={msg()}
                  onOpenUser={() => {
                    const id = profileUserId();
                    if (id) usersStore.openUserProfile(id);
                  }}
                  user={user}
                  userId={profileUserId()}
                />
              </Show>
              <Show fallback={<div class="message-content-pending" />} when={deferred.ready()}>
                <MessageTextContent
                  attachments={visibleAttachments()}
                  channelId={props.channelId}
                  hasEnlargedEmojiOnlyText={hasEnlargedEmojiOnlyText()}
                  isEditing={isEditing()}
                  messageText={messageText()}
                  msg={msg()}
                  onStopEdit={props.onStopEdit}
                  renderBlocks={renderBlocks()}
                  replyRef={replyRef()}
                  tz={user()?.tz}
                />
                <Slot
                  attachments={visibleAttachments()}
                  channelId={props.channelId}
                  isEditing={isEditing()}
                  msg={msg()}
                  onOpenThread={props.onOpenThread}
                  point="messages.body"
                  threadTs={props.threadTs}
                />
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <Show when={showRepliesDivider()}>
        <RepliesDivider count={neighbors().repliesCount} day={neighbors().repliesDividerDay} />
      </Show>
    </Show>
  );
}
