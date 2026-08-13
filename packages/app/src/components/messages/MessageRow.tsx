import { BlockKit, Mrkdwn, TimeAnchorContext } from "@slock/blockkit";
import type { Message } from "@slock/slack-api";
import {
  AvatarStack,
  ContextMenu,
  Icon,
  InlineFeedback,
  logDeletedMessages,
  openContextMenuFromKeyboard,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { actionFeedback, formatInteractorNames, store } from "../../lib/store";
import Composer from "../composer/Composer";
import UserHoverCard from "../user/UserHoverCard";
import { MessageAvatarButton } from "./MessageAuthorButtons";
import "./MessageList.css";
import MessageMeta from "./MessageMeta";
import AttachmentCard from "./parts/media/AttachmentCard";
import MessageFiles from "./parts/media/MessageFiles";
import MessageActionsBar from "./parts/MessageActionsBar";
import MessageActionsMenuItems from "./parts/MessageActionsMenuItems";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  resolveBotProfileUserId,
  resolveMessageRenderState,
  resolveProfileUserId,
} from "./parts/messageRenderState";
import ReactionRow from "./parts/ReactionRow";
import ReplyReferenceRow from "./parts/ReplyReferenceRow";

const MESSAGE_CONTENT_ELEMENT_SELECTOR =
  "a, button, input, textarea, select, img, video, audio, canvas, svg, iframe, object, embed";

function rectContainsPoint(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pointIntersectsText(root: HTMLElement, x: number, y: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let index = 0; index < rects.length; index += 1) {
        if (rectContainsPoint(rects[index], x, y)) return true;
      }
    }
    node = walker.nextNode();
  }
  return false;
}

function hasVisibleBox(element: Element) {
  const style = getComputedStyle(element);
  const hasBackground =
    style.backgroundImage !== "none" ||
    (style.backgroundColor !== "transparent" && style.backgroundColor !== "rgba(0, 0, 0, 0)");
  const hasBorder =
    (style.borderTopStyle !== "none" && Number.parseFloat(style.borderTopWidth) > 0) ||
    (style.borderRightStyle !== "none" && Number.parseFloat(style.borderRightWidth) > 0) ||
    (style.borderBottomStyle !== "none" && Number.parseFloat(style.borderBottomWidth) > 0) ||
    (style.borderLeftStyle !== "none" && Number.parseFloat(style.borderLeftWidth) > 0);
  return hasBackground || hasBorder || style.boxShadow !== "none";
}

function isMessageBackgroundContextMenu(event: MouseEvent & { currentTarget: HTMLDivElement }) {
  const { currentTarget, target } = event;
  if (!(target instanceof Element)) return false;

  const contentElement = target.closest(MESSAGE_CONTENT_ELEMENT_SELECTOR);
  if (contentElement && currentTarget.contains(contentElement)) return false;
  if (pointIntersectsText(currentTarget, event.clientX, event.clientY)) return false;

  let element: Element | null = target;
  while (element && element !== currentTarget) {
    if (hasVisibleBox(element)) return false;
    element = element.parentElement;
  }
  return true;
}

export type MessageRowProps = {
  message: Message;
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
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
            <Show
              fallback={
                <MessageAvatarButton
                  color={user()?.avatarColor}
                  name={displayName()}
                  onClick={() => {}}
                  src={avatarUrl()}
                  tabbable={focused()}
                  userId={msg().userId}
                />
              }
              when={profileUserId()}
            >
              {(userId) => (
                <UserHoverCard userId={userId()}>
                  <MessageAvatarButton
                    color={user()?.avatarColor}
                    name={displayName()}
                    onClick={() => store.users.openUserProfile(userId())}
                    src={avatarUrl()}
                    tabbable={focused()}
                    userId={userId()}
                  />
                </UserHoverCard>
              )}
            </Show>
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
            <Show
              fallback={
                <Composer
                  channelId={props.channelId}
                  editing={{
                    initialText: replyRef()?.rest ?? msg().text,
                    onCancel: () => props.onStopEdit?.(),
                    onSave: async (text, blocks) => {
                      const saved = await store.messages.editMessageText(
                        props.channelId,
                        msg().ts,
                        (replyRef()?.prefix ?? "") + text,
                        blocks,
                      );
                      if (saved) props.onStopEdit?.();
                      return saved;
                    },
                  }}
                />
              }
              when={!isEditing()}
            >
              <div
                class={`message-text${msg().deleted ? " message-deleted-text" : ""}`}
                classList={{ "message-emoji-only": hasEnlargedEmojiOnlyText() }}
              >
                <TimeAnchorContext.Provider
                  value={{ ms: parseFloat(msg().ts) * 1000, tz: user()?.tz }}
                >
                  <Show
                    fallback={
                      <>
                        <Mrkdwn text={messageText()} />
                        <Show when={msg().edited}>
                          <span class="message-edited"> (edited)</span>
                        </Show>
                      </>
                    }
                    when={renderBlocks()}
                  >
                    {(blocks) => (
                      <BlockKit
                        blocks={blocks()}
                        context={{
                          botId: msg().botId,
                          botUserId: msg().userId,
                          channelId: props.channelId,
                          messageTs: msg().ts,
                          threadTs: msg().threadTs,
                        }}
                        trailing={
                          msg().edited ? <span class="message-edited"> (edited)</span> : undefined
                        }
                      />
                    )}
                  </Show>
                </TimeAnchorContext.Provider>
              </div>
            </Show>
            <Show when={msg().files?.length ? msg().files : undefined}>
              {(files) => <MessageFiles files={files()} />}
            </Show>
            <Show when={visibleAttachments()?.length}>
              <For each={visibleAttachments()}>
                {(a) => (
                  <AttachmentCard
                    attachment={a}
                    context={{
                      botId: msg().botId,
                      botUserId: msg().userId,
                      channelId: props.channelId,
                      messageTs: msg().ts,
                      threadTs: msg().threadTs,
                    }}
                    showPermalink={
                      !!a.fromUrl &&
                      !msg().text.includes(a.fromUrl) &&
                      !a.pretext?.includes(a.fromUrl)
                    }
                    isEphemeral={msg().isEphemeral ?? false}
                  />
                )}
              </For>
            </Show>
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
              <button
                class="message-replies btn-reset flex-align-center"
                onClick={() => props.onOpenThread?.(msg().ts)}
                type="button"
              >
                <Show
                  fallback={<Icon name="threads" size={14} />}
                  when={msg().replyUsers?.length ? msg().replyUsers : undefined}
                >
                  {(users) => (
                    <Tooltip
                      content={formatInteractorNames(
                        users(),
                        store.users.currentUser()?.id,
                        store.users.userById,
                      )}
                    >
                      <AvatarStack
                        users={users()
                          .map((id) => store.users.userById(id))
                          .filter((u) => u !== undefined)}
                        max={3}
                      />
                    </Tooltip>
                  )}
                </Show>
                <span class="message-replies-count">
                  {msg().replyCount} {msg().replyCount === 1 ? "reply" : "replies"}
                </span>
                <Show when={msg().lastReplyLabel}>
                  <span class="message-replies-last">Last reply {msg().lastReplyLabel}</span>
                </Show>
              </button>
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
