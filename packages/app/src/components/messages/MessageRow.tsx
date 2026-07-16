// biome-ignore-all lint/style/noExcessiveLinesPerFile: Message rendering branches share state and interaction wiring that is clearer in one component.
import { BlockKit, Mrkdwn } from "@slock/blockkit";
import type {
  Block,
  Message,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
  TextObject,
} from "@slock/slack-api";
import {
  AvatarStack,
  ContextMenu,
  Icon,
  InlineFeedback,
  logDeletedMessages,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { parseReplyLink } from "../../lib/replyLink";
import { actionFeedback, store } from "../../lib/store";
import Composer from "../composer/Composer";
import UserHoverCard from "../user/UserHoverCard";
import { MessageAvatarButton } from "./MessageAuthorButtons";
import "./MessageList.css";
import MessageMeta from "./MessageMeta";
import MessageActionsBar from "./parts/MessageActionsBar";
import MessageActionsMenuItems from "./parts/MessageActionsMenuItems";
import AttachmentCard from "./parts/media/AttachmentCard";
import MessageFiles from "./parts/media/MessageFiles";
import ReactionRow from "./parts/ReactionRow";
import ReplyReferenceRow from "./parts/ReplyReferenceRow";

const EMOJI_SHORTCODE_RE = /:([a-z0-9_+-]+):/gi;
const USER_PROFILE_ID_RE = /^[UW]/;
const MAX_ENLARGED_EMOJI = 25;

function isEmojiOnlyMessage(text: string): boolean {
  const count = emojiShortcodeCount(text);
  return count !== undefined && count > 0 && count < MAX_ENLARGED_EMOJI;
}

function emojiShortcodeCount(text: string): number | undefined {
  const emoji = text.match(EMOJI_SHORTCODE_RE);
  return text.replace(EMOJI_SHORTCODE_RE, "").trim() ? undefined : (emoji?.length ?? 0);
}

function emojiOnlyRichTextCount(block: RichTextBlock): number | undefined {
  let count = 0;
  const addElements = (elements: RichTextInlineElement[]) => {
    for (const element of elements) {
      if (element.type === "emoji") count += 1;
      else if (element.type === "text") {
        const textCount = emojiShortcodeCount(element.text);
        if (textCount === undefined) return false;
        count += textCount;
      } else return false;
    }
    return true;
  };
  const addSubBlock = (subBlock: RichTextSubBlock) => {
    if (subBlock.type === "rich_text_list")
      return subBlock.elements.every((section) => addElements(section.elements));
    return addElements(subBlock.elements);
  };

  return block.elements.every(addSubBlock) ? count : undefined;
}

function emojiOnlyBlockMessage(blocks: Block[]): boolean {
  let count = 0;
  const addText = (text: TextObject | undefined) => {
    if (!text) return false;
    const textCount = emojiShortcodeCount(text.text);
    if (textCount === undefined) return false;
    count += textCount;
    return true;
  };

  for (const block of blocks) {
    if (block.type === "rich_text") {
      const richTextCount = emojiOnlyRichTextCount(block as RichTextBlock);
      if (richTextCount === undefined) return false;
      count += richTextCount;
    } else if (block.type === "section") {
      const section = block as Extract<Block, { type: "section" }>;
      if (section.accessory || section.fields?.length || !addText(section.text)) return false;
    } else if (block.type === "header") {
      if (!addText((block as Extract<Block, { type: "header" }>).text)) return false;
    } else return false;
  }

  return count > 0 && count < MAX_ENLARGED_EMOJI;
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
};

export default function MessageRow(props: MessageRowProps) {
  const msg = props.message;
  const prev = () => props.messages[props.index() - 1];
  const isThreadRoot = () => !!props.threadTs && msg.ts === props.threadTs;
  const dayChanged = () => {
    const p = prev();
    if (isThreadRoot()) return msg.day !== "Today";
    return !p || p.day !== msg.day;
  };
  const showUnreadDivider = () => {
    const p = prev();
    if (props.threadTs && !p) return false;
    const anchor = store.unread.unreadDividerTsForChannel(props.channelId);
    if (anchor == null) return false;
    if (parseFloat(msg.ts) * 1000 <= anchor) return false;
    return !p || parseFloat(p.ts) * 1000 <= anchor;
  };
  const showRepliesDivider = () => !!props.threadTs && !prev() && (msg.replyCount ?? 0) > 0;
  const isInThread = (channelId: string, ts: string) =>
    !!props.threadTs &&
    channelId === props.channelId &&
    (ts === props.threadTs || props.messages.some((m) => m.ts === ts));
  const replyRef = createMemo(() => parseReplyLink(msg.text, isInThread));
  const messageText = () => replyRef()?.rest ?? msg.text;
  const hasEnlargedEmojiOnlyText = () =>
    msg.blocks?.length ? emojiOnlyBlockMessage(msg.blocks) : isEmojiOnlyMessage(messageText());
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
    return ref ? msg.attachments?.find((a) => a.isMessageUnfurl && a.ts === ref.ts) : undefined;
  });
  const showThreadContext = createMemo(
    () => !!(props.onOpenThread && msg.isBroadcast && msg.threadTs),
  );
  const threadParent = createMemo(() =>
    showThreadContext()
      ? (msg.threadRoot ??
        props.messages.find((m) => m.ts === msg.threadTs) ??
        store.messages
          .findAllMessageLocations(props.channelId, msg.threadTs ?? "")[0]
          ?.list.find((m) => m.ts === msg.threadTs))
      : undefined,
  );
  const visibleAttachments = createMemo(() =>
    msg.attachments?.filter((a) => !(a.isMessageUnfurl && a.ts === replyRef()?.ts)),
  );
  const isPinned = () => store.pinned.isMessagePinned(props.channelId, msg.ts);
  const sameAuthorAsPrev = () => {
    const p = prev();
    return (
      !!p &&
      p.userId === msg.userId &&
      !dayChanged() &&
      p.kind === msg.kind &&
      !isPinned() &&
      !replyRef() &&
      !showThreadContext()
    );
  };
  const isSlackbot = () => msg.botName === "Slackbot";
  const profileUserId = () => {
    const id = USER_PROFILE_ID_RE.test(msg.userId)
      ? msg.userId
      : isSlackbot()
        ? "USLACKBOT"
        : msg.userId;
    return USER_PROFILE_ID_RE.test(id) ? id : undefined;
  };
  const user = createMemo(() => (msg.userId ? store.users.userById(msg.userId) : undefined));
  const displayName = () => user()?.name ?? msg.botName ?? "Unknown";
  const avatarUrl = () => user()?.avatarUrl ?? msg.botIcon;
  const [isEditing, setIsEditing] = createSignal(false);
  const ctxMenu = useContextMenu();
  return (
    <Show when={!msg.deleted || logDeletedMessages()}>
      <Show when={dayChanged() || showUnreadDivider()}>
        <div
          class="message-divider flex-align-center text-center font-bold text-xs"
          classList={{ "day-divider": dayChanged(), "unread-divider": showUnreadDivider() }}
        >
          <span>
            {dayChanged()
              ? showUnreadDivider()
                ? `${msg.day} · New messages`
                : msg.day
              : "New messages"}
          </span>
        </div>
      </Show>
      <div
        class="message-row-group"
        classList={{
          compact: sameAuthorAsPrev(),
          deleted: msg.deleted,
          ephemeral: msg.isEphemeral,
          saved: store.later.isSavedForLater(msg.ts),
        }}
      >
        <Show when={replyRef()}>
          <ReplyReferenceRow
            attachment={replyUnfurl()}
            message={referencedMessage()}
            onJump={() => props.onJumpToMessage?.(replyRef()?.ts ?? "")}
          />
        </Show>
        <Show when={showThreadContext()}>
          <ReplyReferenceRow
            icon="threads"
            message={threadParent()}
            onJump={() => props.onOpenThread?.(msg.threadTs ?? "")}
          />
        </Show>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: right-click-to-open-context-menu is a mouse-only convenience alongside the row's own interactive children */}
        <div
          class="message-row"
          data-message-ts={msg.ts}
          onContextMenu={(e) => {
            if (msg.deleted || msg.isEphemeral || isEditing()) return;
            // Right-clicking actual embedded content (an image, video, or real
            // link) is left alone so the browser's own, more relevant menu
            // shows instead (Save image, Copy link, etc.) — this row's own
            // generic message menu would only get in the way there.
            if ((e.target as HTMLElement).closest("img, video, a")) return;
            store.resources.loadMessageShortcuts();
            ctxMenu.open(e);
          }}
        >
          <Show when={!(msg.deleted || msg.isEphemeral)}>
            <MessageActionsBar
              channelId={props.channelId}
              msg={msg}
              onEditRequest={() => setIsEditing(true)}
              onOpenThread={props.onOpenThread}
              onReplyLink={props.onReplyLink}
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
                msg={msg}
                onClose={ctxMenu.close}
                onEditRequest={() => setIsEditing(true)}
                threadTs={props.threadTs}
              />
            </ContextMenu>
          </Show>
          <Show
            fallback={<div class="message-avatar-spacer">{msg.time.split(" ")[0]}</div>}
            when={!sameAuthorAsPrev()}
          >
            <Show
              fallback={
                <MessageAvatarButton
                  color={user()?.avatarColor}
                  onClick={() => {}}
                  src={avatarUrl()}
                />
              }
              when={profileUserId()}
            >
              {(userId) => (
                <UserHoverCard userId={userId()}>
                  <MessageAvatarButton
                    color={user()?.avatarColor}
                    onClick={() => store.users.openUserProfile(userId())}
                    src={avatarUrl()}
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
                message={{ ...msg, isSaved: store.later.isSavedForLater(msg.ts) } as Message}
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
                    initialText: replyRef()?.rest ?? msg.text,
                    onCancel: () => setIsEditing(false),
                    onSave: (text, blocks) => {
                      store.messages.editMessageText(
                        props.channelId,
                        msg.ts,
                        (replyRef()?.prefix ?? "") + text,
                        blocks,
                      );
                      setIsEditing(false);
                    },
                  }}
                />
              }
              when={!isEditing()}
            >
              <div
                class={`message-text${msg.deleted ? " message-deleted-text" : ""}`}
                classList={{ "message-emoji-only": hasEnlargedEmojiOnlyText() }}
              >
                <Show
                  fallback={
                    <>
                      <Mrkdwn text={messageText()} />
                      <Show when={msg.edited}>
                        <span class="message-edited"> (edited)</span>
                      </Show>
                    </>
                  }
                  when={!replyRef() && msg.blocks?.length ? msg.blocks : undefined}
                >
                  {(blocks) => (
                    <BlockKit
                      blocks={blocks()}
                      context={{
                        botId: msg.botId,
                        channelId: props.channelId,
                        messageTs: msg.ts,
                        threadTs: msg.threadTs,
                      }}
                      trailing={
                        msg.edited ? <span class="message-edited"> (edited)</span> : undefined
                      }
                    />
                  )}
                </Show>
              </div>
            </Show>
            <Show when={msg.files?.length ? msg.files : undefined}>
              {(files) => <MessageFiles files={files()} />}
            </Show>
            <Show when={visibleAttachments()?.length}>
              <For each={visibleAttachments()}>{(a) => <AttachmentCard attachment={a} />}</For>
            </Show>
            <Show when={msg.reactions?.length ? msg.reactions : undefined}>
              {(reactions) => (
                <ReactionRow
                  onToggle={(name) => store.messages.reactToMessage(props.channelId, msg, name)}
                  reactions={reactions()}
                />
              )}
            </Show>
            <InlineFeedback
              class="message-feedback"
              feedback={actionFeedback.get(msg.ts)}
              priority={props.threadTs ? 1 : 0}
            />
            <Show when={props.onOpenThread && (msg.replyCount ?? 0) > 0}>
              <button
                class="message-replies btn-reset flex-align-center"
                onClick={() => props.onOpenThread?.(msg.ts)}
                type="button"
              >
                <Show
                  fallback={<Icon name="threads" size={14} />}
                  when={msg.replyUsers?.length ? msg.replyUsers : undefined}
                >
                  {(users) => (
                    <Tooltip
                      content={users()
                        .map((id) =>
                          id === store.users.currentUser()?.id
                            ? "you"
                            : (store.users.userById(id)?.name ?? "someone"),
                        )
                        .reduce(
                          (prev, curr, i, a) =>
                            (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
                          "",
                        )}
                    >
                      <AvatarStack
                        users={users()
                          .slice(0, 5)
                          .map((id) => store.users.userById(id))
                          .filter((u) => u !== undefined)}
                      />
                    </Tooltip>
                  )}
                </Show>
                <span class="message-replies-count">
                  {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
                </span>
                <Show when={msg.lastReplyLabel}>
                  <span class="message-replies-last">Last reply {msg.lastReplyLabel}</span>
                </Show>
              </button>
            </Show>
          </div>
        </div>
      </div>
      <Show when={showRepliesDivider()}>
        <div class="day-divider message-divider flex-align-center text-center font-bold text-xs">
          <span>
            {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
          </span>
        </div>
      </Show>
    </Show>
  );
}
