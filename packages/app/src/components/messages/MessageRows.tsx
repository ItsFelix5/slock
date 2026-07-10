import { BlockKit, EmojiText, Mrkdwn } from "@slock/blockkit";
import type { Message } from "@slock/slack-api";
import { Icon, logDeletedMessages } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { parseReplyLink } from "../../lib/replyLink";
import { editMessageText, openUserProfile, reactToMessage, userById } from "../../lib/store";
import Composer from "../composer/Composer";
import UserHoverCard from "../user/UserHoverCard";
import AttachmentCard from "./AttachmentCard";
import InteractorAvatars from "./InteractorAvatars";
import MessageActionsBar from "./MessageActionsBar";
import MessageFiles from "./MessageFiles";
import ReactionRow from "./ReactionRow";
import ReplyReferenceRow from "./ReplyReferenceRow";
import SystemMessage from "./SystemMessage";
import "./MessageList.css";

export default function MessageRows(props: {
  messages: Message[];
  channelId: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
}) {
  return (
    <For each={props.messages}>
      {(msg, i) => {
        const prev = () => props.messages[i() - 1];
        const showDayDivider = () => {
          const p = prev();
          return !p || p.day !== msg.day;
        };
        const replyRef = createMemo(() => parseReplyLink(msg.text));
        const referencedMessage = createMemo(() =>
          props.messages.find((m) => m.ts === replyRef()?.ts),
        );
        // Slack auto-unfurls the permalink in `attachments` — redundant with
        // our own ReplyReferenceRow above the message, so drop just that one.
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
            !replyRef()
          );
        };
        // Bot messages carry their own username/icon rather than a real user id
        // (frequently a bot_id that isn't a resolvable user) — don't bounce that
        // through userById, which would just burn a wasted /api/user lookup.
        // Slackbot's own automated announcements are a special case: Slack delivers
        // them as bot_message with username "Slackbot" but no icons at all, so
        // resolve the real Slackbot user instead of falling back to a generic 🤖.
        const isSlackbot = () => msg.botName === "Slackbot";
        const user = createMemo(() => {
          if (isSlackbot()) return userById("USLACKBOT");
          return msg.botName ? undefined : userById(msg.userId);
        });
        const displayName = () => msg.botName ?? user()?.name ?? "Unknown";
        const avatarUrl = () => msg.botIcon ?? user()?.avatarUrl;
        const [isEditing, setIsEditing] = createSignal(false);

        const avatarButton = () => (
          <button
            type="button"
            class="message-avatar"
            style={{ background: user()?.avatarColor ?? "#616061" }}
            onClick={() => !msg.botName && openUserProfile(msg.userId)}
          >
            <Show when={avatarUrl()} fallback={msg.botName ? "🤖" : (user()?.initials ?? "?")}>
              {(url) => <img class="message-avatar-img" src={url()} alt="" />}
            </Show>
          </button>
        );

        const authorButton = () => (
          <button
            type="button"
            class="message-author"
            disabled={!!msg.botName}
            onClick={() => !msg.botName && openUserProfile(msg.userId)}
          >
            {displayName()}
          </button>
        );

        return (
          <Show when={!msg.deleted || logDeletedMessages()}>
            <Show when={showDayDivider()}>
              <div class="day-divider">
                <span>{msg.day}</span>
              </div>
            </Show>
            <Show
              when={msg.kind !== "system"}
              fallback={<SystemMessage text={msg.text} time={msg.time} />}
            >
              <Show when={replyRef()}>
                <ReplyReferenceRow
                  message={referencedMessage()}
                  onJump={() => props.onJumpToMessage?.(replyRef()?.ts ?? "")}
                />
              </Show>
              <div
                class="message-row"
                classList={{ compact: sameAuthorAsPrev(), deleted: msg.deleted }}
                data-message-ts={msg.ts}
              >
                <Show when={!msg.deleted}>
                  <MessageActionsBar
                    channelId={props.channelId}
                    msg={msg}
                    onOpenThread={props.onOpenThread}
                    onReplyLink={props.onReplyLink}
                    onEditRequest={() => setIsEditing(true)}
                  />
                </Show>
                <Show
                  when={!sameAuthorAsPrev()}
                  fallback={<div class="message-avatar-spacer">{msg.time.split(" ")[0]}</div>}
                >
                  <Show when={!msg.botName} fallback={avatarButton()}>
                    <UserHoverCard userId={msg.userId}>{avatarButton()}</UserHoverCard>
                  </Show>
                </Show>
                <div class="message-body">
                  <Show when={!sameAuthorAsPrev()}>
                    <div class="message-meta">
                      <Show when={!msg.botName} fallback={authorButton()}>
                        <UserHoverCard userId={msg.userId}>{authorButton()}</UserHoverCard>
                      </Show>
                      <Show when={user()?.statusEmoji}>
                        {(emoji) => (
                          <span class="message-status-emoji">
                            <EmojiText text={emoji()} />
                            <Show when={user()?.statusText}>
                              <span class="message-status-tooltip">{user()?.statusText}</span>
                            </Show>
                          </span>
                        )}
                      </Show>
                      <Show when={msg.botName}>
                        <span class="message-bot-badge">APP</span>
                      </Show>
                      <span class="message-time">{msg.time}</span>
                      <Show when={user()?.pronouns}>
                        <span class="pronouns">•&nbsp;{user()?.pronouns}</span>
                      </Show>
                    </div>
                  </Show>

                  <Show
                    when={!isEditing()}
                    fallback={
                      <Composer
                        channelId={props.channelId}
                        editing={{
                          initialText: replyRef()?.rest ?? msg.text,
                          onSave: (text, blocks) => {
                            editMessageText(
                              props.channelId,
                              msg.ts,
                              (replyRef()?.prefix ?? "") + text,
                              blocks,
                            );
                            setIsEditing(false);
                          },
                          onCancel: () => setIsEditing(false),
                        }}
                      />
                    }
                  >
                    <div class={`message-text${msg.deleted ? " message-deleted-text" : ""}`}>
                      <Show
                        // Slack auto-generates `blocks` (rich_text) for any plain-text
                        // message, promoting a detected bare URL — our reply-link
                        // marker — into a real link element. That'd re-render the raw
                        // permalink even though `text` itself round-trips untouched, so
                        // a reply-linked message always renders from the parsed/stripped
                        // text instead of trusting Slack's auto blocks.
                        when={!replyRef() && msg.blocks?.length ? msg.blocks : undefined}
                        fallback={<Mrkdwn text={replyRef()?.rest ?? msg.text} />}
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
                    <For each={visibleAttachments()}>
                      {(a) => <AttachmentCard attachment={a} />}
                    </For>
                  </Show>

                  <Show when={msg.reactions?.length ? msg.reactions : undefined}>
                    {(reactions) => (
                      <ReactionRow
                        reactions={reactions()}
                        onToggle={(name) => reactToMessage(props.channelId, msg, name)}
                      />
                    )}
                  </Show>

                  <Show when={props.onOpenThread && (msg.replyCount ?? 0) > 0}>
                    <button
                      type="button"
                      class="message-replies"
                      onClick={() => props.onOpenThread?.(msg.ts)}
                    >
                      <Show
                        when={msg.replyUsers?.length ? msg.replyUsers : undefined}
                        fallback={<Icon name="threads" size={14} />}
                      >
                        {(users) => <InteractorAvatars userIds={users()} />}
                      </Show>{" "}
                      {msg.replyCount} {msg.replyCount === 1 ? "reply" : "replies"}
                    </button>
                  </Show>
                </div>
              </div>
            </Show>
          </Show>
        );
      }}
    </For>
  );
}
