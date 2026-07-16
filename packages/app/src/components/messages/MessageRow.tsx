import { BlockKit, Mrkdwn } from "@slock/blockkit";
import type { Message } from "@slock/slack-api";
import {
  AvatarStack,
  ContextMenu,
  Icon,
  InlineFeedback,
  logDeletedMessages,
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
export type MessageRowProps = {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
  index: () => number;
};

export default function MessageRow(props: MessageRowProps) {
  const msg = props.messages[props.index()];
  const prev = () => props.messages[props.index() - 1];
  const dayChanged = () => {
    const p = prev();
    if (props.threadTs && (!p || p.ts === props.threadTs)) return false;
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
  const showDayDivider = () => dayChanged() && !showUnreadDivider();
  const showRepliesDivider = () => !!props.threadTs && !prev() && (msg.replyCount ?? 0) > 0;
  const replyRef = createMemo(() => parseReplyLink(msg.text));
  const referencedMessage = createMemo(() => props.messages.find((m) => m.ts === replyRef()?.ts));
  const showThreadContext = createMemo(
    () => !!(props.onOpenThread && msg.isBroadcast && msg.threadTs),
  );
  const threadParent = createMemo(() =>
    showThreadContext() ? props.messages.find((m) => m.ts === msg.threadTs) : undefined,
  );
  const visibleAttachments = createMemo(() =>
    msg.attachments?.filter((a) => !(a.isMessageUnfurl && a.ts === replyRef()?.ts)),
  );
  const sameAuthorAsPrev = () => {
    const p = prev();
    return (
      !!p &&
      p.userId === msg.userId &&
      !showDayDivider() &&
      p.kind === msg.kind &&
      !replyRef() &&
      !showThreadContext()
    );
  };
  const isSlackbot = () => msg.botName === "Slackbot";
  const user = createMemo(() => {
    if (isSlackbot()) return store.users.userById("USLACKBOT");
    return msg.botName ? undefined : store.users.userById(msg.userId);
  });
  const displayName = () => msg.botName ?? user()?.name ?? "Unknown";
  const avatarUrl = () => msg.botIcon ?? user()?.avatarUrl;
  const [isEditing, setIsEditing] = createSignal(false);
  const ctxMenu = useContextMenu();
  return (
    <Show when={!msg.deleted || logDeletedMessages()}>
      <Show when={showDayDivider()}>
        <div class="day-divider message-divider flex-align-center text-center font-bold text-xs">
          <span>{msg.day}</span>
        </div>
      </Show>
      <Show when={showUnreadDivider()}>
        <div class="unread-divider message-divider flex-align-center text-center font-bold text-xs">
          <span>{dayChanged() ? `${msg.day} · New messages` : "New messages"}</span>
        </div>
      </Show>
      <Show when={replyRef()}>
        <ReplyReferenceRow
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
        classList={{
          compact: sameAuthorAsPrev(),
          deleted: msg.deleted,
          ephemeral: msg.isEphemeral,
          saved: store.later.isSavedForLater(msg.ts),
        }}
        data-message-ts={msg.ts}
        onContextMenu={(e) => {
          if (msg.deleted || msg.isEphemeral || isEditing()) return;
          // Right-clicking actual embedded content (an image, video, or real
          // link) is left alone so the browser's own, more relevant menu
          // shows instead (Save image, Copy link, etc.) — this row's own
          // generic message menu would only get in the way there.
          if ((e.target as HTMLElement).closest("img, video, a")) return;
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
            when={!msg.botName}
          >
            <UserHoverCard userId={msg.userId}>
              <MessageAvatarButton
                color={user()?.avatarColor}
                onClick={() => store.users.openUserProfile(msg.userId)}
                src={avatarUrl()}
              />
            </UserHoverCard>
          </Show>
        </Show>
        <div class="message-body">
          <Show when={!sameAuthorAsPrev()}>
            <MessageMeta
              displayName={displayName}
              message={{ ...msg, isSaved: store.later.isSavedForLater(msg.ts) } as Message}
              onOpenUser={() => store.users.openUserProfile(msg.userId)}
              user={user}
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
            <div class={`message-text${msg.deleted ? "message-deleted-text" : ""}`}>
              <Show
                fallback={<Mrkdwn text={replyRef()?.rest ?? msg.text} />}
                when={!replyRef() && msg.blocks?.length ? msg.blocks : undefined}
              >
                {(blocks) => <BlockKit blocks={blocks()} />}
              </Show>
              <Show when={msg.edited}>
                <span class="message-edited"> (edited)</span>
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
          <InlineFeedback class="message-feedback" feedback={actionFeedback.get(msg.ts)} />
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
                  <AvatarStack
                    title={() =>
                      users()
                        .map((id) =>
                          id === store.users.currentUser()?.id
                            ? "you"
                            : (store.users.userById(id)?.name ?? "someone"),
                        )
                        .reduce(
                          (prev, curr, i, a) =>
                            (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
                          "",
                        )
                    }
                    users={users()
                      .slice(0, 3)
                      .map((id) => store.users.userById(id))
                      .filter((u) => u !== undefined)}
                  />
                )}
              </Show>{" "}
              {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
              <Show when={msg.lastReplyLabel}>
                <span class="message-replies-last">Last reply {msg.lastReplyLabel}</span>
              </Show>
            </button>
          </Show>
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
