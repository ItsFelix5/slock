import type { Message } from "@slock/types";
import { ContextMenu, InlineFeedback, logDeletedMessages, useContextMenu } from "@slock/ui";
import { createMemo, createSignal, Show } from "solid-js";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import { isMessageBackgroundContextMenu } from "./messageContextMenuTarget";
import type { OpenThreadHandler } from "./messageFocus";
import "./MessageList.css";
import MessageMeta from "./MessageMeta";
import MessageActionsBar from "./parts/MessageActionsBar";
import MessageActionsMenuItems from "./parts/MessageActionsMenuItems";
import MessageAttachmentList from "./parts/MessageAttachmentList";
import MessageRepliesButton from "./parts/MessageRepliesButton";
import MessageRowAvatar from "./parts/MessageRowAvatar";
import MessageTextContent from "./parts/MessageTextContent";
import MessageFiles from "./parts/media/MessageFiles";
import PendingFiles from "./parts/media/PendingFiles";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveBotProfileUserId,
  resolveLookupUserId,
  resolveProfileUserId,
} from "./parts/messageAuthor";
import { resolveMessageContent, resolveMessageNeighbors } from "./parts/messageRenderState";
import ReactionRow from "./parts/ReactionRow";
import ReplyReferenceRow from "./parts/ReplyReferenceRow";

export type MessageRowProps = {
  message: Message;
  messages: Message[];
  messageByTs: () => Map<string, Message>;
  channelId: string;
  threadTs?: string;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
  index: () => number;
  focusedTs?: () => string | null;
  editingTs?: () => string | null;
  onStartEdit?: (ts: string) => void;
  onStopEdit?: () => void;
  reactionPickerTs?: () => string | null;
  onToggleReactionPicker?: (ts: string) => void;
  moreMenuTs?: () => string | null;
  onToggleMoreMenu?: (ts: string) => void;
};

export default function MessageRow(props: MessageRowProps) {
  const msg = () => props.message;
  const prev = createMemo(() => {
    for (let i = props.index() - 1; i >= 0; i -= 1) {
      const candidate = props.messages[i];
      if (!candidate.deleted || logDeletedMessages()) return candidate;
    }
  });
  const isPinned = () => store.pinned.isMessagePinned(props.channelId, msg().ts);
  const content = createMemo(() =>
    resolveMessageContent(msg(), {
      channelId: props.channelId,
      hasOpenThread: !!props.onOpenThread,
      messages: () => props.messages,
      threadTs: props.threadTs,
    }),
  );
  const neighbors = createMemo(() =>
    resolveMessageNeighbors(msg(), prev(), content(), {
      channelId: props.channelId,
      isPinned: isPinned(),
      messages: () => props.messages,
      showDeleted: logDeletedMessages(),
      threadTs: props.threadTs,
      unreadDividerTs: store.unread.unreadDividerTsForChannel(props.channelId),
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
      store.messages
        .findAllMessageLocations(ref.channelId, ref.ts)[0]
        ?.list.find((m) => m.ts === ref.ts)
    );
  });
  const replyUnfurl = createMemo(() => {
    const ref = replyRef();
    return ref ? msg().attachments?.find((a) => a.isMessageUnfurl && a.ts === ref.ts) : undefined;
  });
  const showThreadContext = () => content().showThreadContext;
  const threadParent = createMemo(() =>
    showThreadContext()
      ? (msg().threadRoot ??
        props.messageByTs().get(msg().threadTs ?? "") ??
        store.messages
          .findAllMessageLocations(props.channelId, msg().threadTs ?? "")[0]
          ?.list.find((m) => m.ts === msg().threadTs))
      : undefined,
  );
  const visibleAttachments = () => content().visibleAttachments;
  const sameAuthorAsPrev = () => neighbors().sameAuthorAsPrev;
  const showBroadcastBadge = () => content().showBroadcastBadge;
  const profileUserId = () => resolveProfileUserId(msg());
  const botProfileUserId = () => resolveBotProfileUserId(msg());
  const user = createMemo(() => {
    const id = resolveLookupUserId(msg());
    return id ? store.users.userById(id) : undefined;
  });
  const displayName = () => resolveAuthorDisplayName(msg(), user()?.name, "Unknown");
  const avatarUrl = () => resolveAuthorAvatarUrl(msg(), user()?.avatarUrl);
  const isEditing = () => props.editingTs?.() === msg().ts;
  const ctxMenu = useContextMenu();

  const saved = () => store.later.isSavedForLater(props.channelId, msg().ts);
  const focused = () => props.focusedTs?.() === msg().ts;
  const [engaged, setEngaged] = createSignal(false);
  const showActions = () =>
    engaged() ||
    focused() ||
    props.reactionPickerTs?.() === msg().ts ||
    props.moreMenuTs?.() === msg().ts;

  return (
    <Show when={neighbors().showMessage}>
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
          pending: msg().pending,
          saved: saved(),
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
          data-message-ts={msg().ts}
          onFocusIn={() => setEngaged(true)}
          onFocusOut={(e) => {
            const next = e.relatedTarget;
            if (!(next instanceof Node && e.currentTarget.contains(next))) setEngaged(false);
          }}
          onMouseEnter={() => setEngaged(true)}
          onMouseLeave={(e) => {
            if (!e.currentTarget.matches(":focus-within")) setEngaged(false);
          }}
          onContextMenu={(e) => {
            if (msg().deleted || msg().isEphemeral || isEditing()) return;
            if (!isMessageBackgroundContextMenu(e)) return;
            store.resources.loadMessageShortcuts();
            ctxMenu.open(e);
          }}
          tabIndex={focused() ? 0 : -1}
        >
          <Show when={!(msg().deleted || msg().isEphemeral)}>
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
            </Show>
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
          <div class="message-body">
            <Show when={!sameAuthorAsPrev()}>
              <MessageMeta
                displayName={displayName}
                isPinned={isPinned}
                isSaved={saved}
                botUserId={botProfileUserId()}
                onOpenBot={() => {
                  const id = botProfileUserId();
                  if (id) store.users.openUserProfile(id);
                }}
                showBroadcastBadge={showBroadcastBadge}
                tabbable={focused}
                message={msg()}
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
            <Show when={!isEditing() && msg().files?.length ? msg().files : undefined}>
              {(files) => <MessageFiles files={files()} />}
            </Show>
            <Show when={msg().pendingFiles?.length ? msg().pendingFiles : undefined}>
              {(files) => <PendingFiles files={files()} />}
            </Show>
            <MessageAttachmentList
              attachments={visibleAttachments()}
              channelId={props.channelId}
              msg={msg()}
            />
            <Show when={msg().reactions?.length ? msg().reactions : undefined}>
              {(reactions) => (
                <ReactionRow
                  allowAdd
                  feedbackKey={msg().ts}
                  isPending={(name) =>
                    store.messages.isReactionPending(props.channelId, msg().ts, name)
                  }
                  onToggle={(name) => store.messages.reactToMessage(props.channelId, msg(), name)}
                  reactions={reactions()}
                />
              )}
            </Show>
            <Show when={actionFeedback.get(msg().ts)}>
              {(feedback) => (
                <InlineFeedback
                  class="message-feedback"
                  feedback={feedback()}
                  priority={props.threadTs ? 1 : 0}
                  variant="icon"
                />
              )}
            </Show>
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
            {neighbors().repliesDividerDay ? ` · ${neighbors().repliesDividerDay}` : ""}
          </span>
        </div>
      </Show>
    </Show>
  );
}
