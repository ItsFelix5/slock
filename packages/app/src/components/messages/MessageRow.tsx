import type { Message } from "@slock/slack-api";
import {
  ContextMenu,
  InlineFeedback,
  logDeletedMessages,
  openContextMenuFromKeyboard,
  useContextMenu,
} from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { actionFeedback, store } from "../../lib/store";
import { isMessageBackgroundContextMenu } from "./messageContextMenuTarget";
import "./MessageList.css";
import MessageMeta from "./MessageMeta";
import MessageActionsBar from "./parts/MessageActionsBar";
import MessageActionsMenuItems from "./parts/MessageActionsMenuItems";
import MessageAttachmentList from "./parts/MessageAttachmentList";
import MessageRepliesButton from "./parts/MessageRepliesButton";
import MessageRowAvatar from "./parts/MessageRowAvatar";
import MessageTextContent from "./parts/MessageTextContent";
import MessageFiles from "./parts/media/MessageFiles";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveBotProfileUserId,
  resolveMessageRenderState,
  resolveProfileUserId,
} from "./parts/messageRenderState";
import ReactionRow from "./parts/ReactionRow";
import ReplyReferenceRow from "./parts/ReplyReferenceRow";

export type MessageRowProps = {
  message: Message;
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string, opts?: { pinned?: boolean }) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
  index: () => number;
  focusedTs?: () => string | null;
  listFocused?: () => boolean;
  editingTs?: () => string | null;
  onStartEdit?: (ts: string) => void;
  onStopEdit?: () => void;
};

export default function MessageRow(props: MessageRowProps) {
  const msg = () => props.message;
  const prev = () => props.messages[props.index() - 1];
  const isPinned = () => store.pinned.isMessagePinned(props.channelId, msg().ts);
  const renderState = createMemo(() =>
    resolveMessageRenderState(msg(), prev(), {
      channelId: props.channelId,
      hasOpenThread: !!props.onOpenThread,
      isPinned: isPinned(),
      messages: props.messages,
      showDeleted: logDeletedMessages(),
      threadTs: props.threadTs,
      unreadDividerTs: store.unread.unreadDividerTsForChannel(props.channelId),
    }),
  );
  const dayChanged = () => renderState().dayChanged;
  const showUnreadDivider = () => renderState().showUnreadDivider;
  const showRepliesDivider = () => renderState().showRepliesDivider;
  const replyRef = () => renderState().replyRef;
  const messageText = () => renderState().messageText;
  const renderBlocks = () => renderState().renderBlocks;
  const hasEnlargedEmojiOnlyText = () => renderState().hasEnlargedEmojiOnlyText;
  const referencedMessage = createMemo(() => {
    const ref = replyRef();
    if (!ref) return;
    return (
      props.messages.find((m) => m.ts === ref.ts) ??
      store.messages
        .findAllMessageLocations(ref.channelId, ref.ts)[0]
        ?.list.find((m) => m.ts === ref.ts)
    );
  });
  const replyUnfurl = createMemo(() => {
    const ref = replyRef();
    return ref ? msg().attachments?.find((a) => a.isMessageUnfurl && a.ts === ref.ts) : undefined;
  });
  const showThreadContext = () => renderState().showThreadContext;
  const threadParent = createMemo(() =>
    showThreadContext()
      ? (msg().threadRoot ??
        props.messages.find((m) => m.ts === msg().threadTs) ??
        store.messages
          .findAllMessageLocations(props.channelId, msg().threadTs ?? "")[0]
          ?.list.find((m) => m.ts === msg().threadTs))
      : undefined,
  );
  const visibleAttachments = () => renderState().visibleAttachments;
  const sameAuthorAsPrev = () => renderState().sameAuthorAsPrev;
  const showBroadcastBadge = () => renderState().showBroadcastBadge;
  const profileUserId = () => resolveProfileUserId(msg());
  const botProfileUserId = () => resolveBotProfileUserId(msg());
  const user = createMemo(() => {
    const id = profileUserId();
    return id ? store.users.userById(id) : undefined;
  });
  const displayName = () => resolveAuthorDisplayName(msg(), user()?.name, "Unknown");
  const avatarUrl = () => resolveAuthorAvatarUrl(msg(), user()?.avatarUrl);
  const isEditing = () => props.editingTs?.() === msg().ts;
  const ctxMenu = useContextMenu();

  const focused = () => props.focusedTs?.() === msg().ts;

  const visuallyFocused = () => focused() && (props.listFocused?.() ?? false);
  return (
    <Show when={renderState().showMessage}>
      <Show when={dayChanged() || showUnreadDivider()}>
        <div
          class="message-divider flex-align-center text-center font-bold text-xs"
          classList={{ "day-divider": dayChanged(), "unread-divider": showUnreadDivider() }}
        >
          <span>
            {dayChanged()
              ? showUnreadDivider()
                ? `${msg().day} · New messages`
                : msg().day
              : "New messages"}
          </span>
        </div>
      </Show>
      <div
        class="message-row-group"
        classList={{
          compact: sameAuthorAsPrev(),
          deleted: msg().deleted,
          ephemeral: msg().isEphemeral,
          "is-first-message": props.index() === 0,
          saved: store.later.isSavedForLater(props.channelId, msg().ts),
        }}
      >
        <Show when={replyRef()}>
          <ReplyReferenceRow
            attachment={replyUnfurl()}
            message={referencedMessage()}
            onJump={() => props.onJumpToMessage?.(replyRef()?.ts ?? "")}
            permalink={replyRef()?.url}
          />
        </Show>
        <Show when={showThreadContext()}>
          <ReplyReferenceRow
            icon="threads"
            message={threadParent()}
            onJump={() => props.onOpenThread?.(msg().threadTs ?? "")}
          />
        </Show>
        <div
          class="message-row"
          classList={{ focused: visuallyFocused() }}
          data-message-ts={msg().ts}
          onContextMenu={(e) => {
            if (msg().deleted || msg().isEphemeral || isEditing()) return;
            if (!isMessageBackgroundContextMenu(e)) return;
            store.resources.loadMessageShortcuts();
            ctxMenu.open(e);
          }}
          onKeyDown={(e) => {
            if (msg().deleted || msg().isEphemeral || isEditing()) return;
            store.resources.loadMessageShortcuts();
            openContextMenuFromKeyboard(e, ctxMenu.openAt);
          }}
          tabIndex={focused() ? 0 : -1}
        >
          <Show when={!(msg().deleted || msg().isEphemeral)}>
            <MessageActionsBar
              channelId={props.channelId}
              msg={msg()}
              onEditRequest={() => props.onStartEdit?.(msg().ts)}
              onOpenThread={props.onOpenThread}
              onReplyLink={props.onReplyLink}
              rowFocused={focused}
              threadTs={props.threadTs}
            />
            <ContextMenu
              onClose={ctxMenu.close}
              open={ctxMenu.isOpen()}
              x={ctxMenu.x()}
              y={ctxMenu.y()}
            >
              <MessageActionsMenuItems
                channelId={props.channelId}
                msg={msg()}
                onClose={ctxMenu.close}
                onEditRequest={() => props.onStartEdit?.(msg().ts)}
                threadTs={props.threadTs}
              />
            </ContextMenu>
          </Show>
          <Show
            fallback={<div class="message-avatar-spacer">{msg().time.split(" ")[0]}</div>}
            when={!sameAuthorAsPrev()}
          >
            <MessageRowAvatar
              avatarUrl={avatarUrl()}
              displayName={displayName()}
              fallbackUserId={msg().userId}
              focused={focused()}
              profileUserId={profileUserId()}
              user={user()}
            />
          </Show>
          <div class="message-body">
            <Show when={!sameAuthorAsPrev()}>
              <MessageMeta
                displayName={displayName}
                isPinned={isPinned}
                botUserId={botProfileUserId()}
                onOpenBot={() => {
                  const id = botProfileUserId();
                  if (id) store.users.openUserProfile(id);
                }}
                showBroadcastBadge={showBroadcastBadge}
                tabbable={focused}
                message={
                  {
                    ...msg(),
                    isSaved: store.later.isSavedForLater(props.channelId, msg().ts),
                  } as Message
                }
                onOpenUser={() => {
                  const id = profileUserId();
                  if (id) store.users.openUserProfile(id);
                }}
                user={user}
                userId={profileUserId()}
              />
            </Show>
            <MessageTextContent
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
            <Show when={msg().files?.length ? msg().files : undefined}>
              {(files) => <MessageFiles files={files()} />}
            </Show>
            <MessageAttachmentList
              attachments={visibleAttachments()}
              channelId={props.channelId}
              msg={msg()}
            />
            <Show when={msg().reactions?.length ? msg().reactions : undefined}>
              {(reactions) => (
                <ReactionRow
                  feedbackKey={msg().ts}
                  isPending={(name) =>
                    store.messages.isReactionPending(props.channelId, msg().ts, name)
                  }
                  onToggle={(name) => store.messages.reactToMessage(props.channelId, msg(), name)}
                  reactions={reactions()}
                />
              )}
            </Show>
            <InlineFeedback
              class="message-feedback"
              feedback={actionFeedback.get(msg().ts)}
              priority={props.threadTs ? 1 : 0}
            />
            <Show when={props.onOpenThread && (msg().replyCount ?? 0) > 0}>
              <MessageRepliesButton msg={msg()} onOpenThread={props.onOpenThread ?? (() => {})} />
            </Show>
          </div>
        </div>
      </div>
      <Show when={showRepliesDivider()}>
        <div class="day-divider message-divider flex-align-center text-center font-bold text-xs">
          <span>
            {msg().replyCount} {msg().replyCount === 1 ? "reply" : "replies"}
            {renderState().repliesDividerDay ? ` · ${renderState().repliesDividerDay}` : ""}
          </span>
        </div>
      </Show>
    </Show>
  );
}
