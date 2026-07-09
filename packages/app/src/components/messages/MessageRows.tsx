import { BlockKit, Mrkdwn } from "@slock/blockkit";
import type { Message } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  editMessageText,
  type MessageLocation,
  openUserProfile,
  reactToMessage,
  userById,
} from "../../lib/store";
import AttachmentCard from "./AttachmentCard";
import MessageActionsBar from "./MessageActionsBar";
import MessageEditForm from "./MessageEditForm";
import MessageFiles from "./MessageFiles";
import ReactionRow from "./ReactionRow";
import SystemMessage from "./SystemMessage";
import "./MessageList.css";

export default function MessageRows(props: {
  messages: Message[];
  channelId: string;
  location: MessageLocation;
  onOpenThread?: (ts: string) => void;
}) {
  return (
    <For each={props.messages}>
      {(msg, i) => {
        const prev = () => props.messages[i() - 1];
        const showDayDivider = () => {
          const p = prev();
          return !p || p.day !== msg.day;
        };
        const sameAuthorAsPrev = () => {
          const p = prev();
          return !!p && p.userId === msg.userId && !showDayDivider() && p.kind === msg.kind;
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

        return (
          <>
            <Show when={showDayDivider()}>
              <div class="day-divider">
                <span>{msg.day}</span>
              </div>
            </Show>
            <Show
              when={msg.kind !== "system"}
              fallback={<SystemMessage text={msg.text} time={msg.time} />}
            >
              <div
                class="message-row"
                classList={{ compact: sameAuthorAsPrev(), deleted: msg.deleted }}
              >
                <Show when={!msg.deleted}>
                  <MessageActionsBar
                    channelId={props.channelId}
                    location={props.location}
                    msg={msg}
                    onOpenThread={props.onOpenThread}
                    onEditRequest={() => setIsEditing(true)}
                  />
                </Show>
                <Show
                  when={!sameAuthorAsPrev()}
                  fallback={<div class="message-avatar-spacer">{msg.time.split(" ")[0]}</div>}
                >
                  <button
                    type="button"
                    class="message-avatar"
                    style={{ background: user()?.avatarColor ?? "#616061" }}
                    onClick={() => !msg.botName && openUserProfile(msg.userId)}
                  >
                    <Show
                      when={avatarUrl()}
                      fallback={msg.botName ? "🤖" : (user()?.initials ?? "?")}
                    >
                      {(url) => <img class="message-avatar-img" src={url()} alt="" />}
                    </Show>
                  </button>
                </Show>
                <div class="message-body">
                  <Show when={!sameAuthorAsPrev()}>
                    <div class="message-meta">
                      <button
                        type="button"
                        class="message-author"
                        disabled={!!msg.botName}
                        onClick={() => !msg.botName && openUserProfile(msg.userId)}
                      >
                        {displayName()}
                      </button>
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
                    when={!msg.deleted}
                    fallback={
                      <div class="message-text message-deleted-text">
                        <Icon name="trash" size={14} /> This message was deleted
                      </div>
                    }
                  >
                    <Show
                      when={!isEditing()}
                      fallback={
                        <MessageEditForm
                          initialText={msg.text}
                          onSave={(text) => {
                            editMessageText(props.location, props.channelId, msg.ts, text);
                            setIsEditing(false);
                          }}
                          onCancel={() => setIsEditing(false)}
                        />
                      }
                    >
                      <div class="message-text">
                        <Show
                          when={msg.blocks?.length ? msg.blocks : undefined}
                          fallback={<Mrkdwn text={msg.text} />}
                        >
                          {(blocks) => <BlockKit blocks={blocks()} />}
                        </Show>
                        <Show when={msg.editedLocally}>
                          <span class="message-edited"> (edited)</span>
                        </Show>
                      </div>
                    </Show>

                    <Show when={msg.files?.length ? msg.files : undefined}>
                      {(files) => <MessageFiles files={files()} />}
                    </Show>

                    <Show when={msg.attachments?.length}>
                      <For each={msg.attachments}>{(a) => <AttachmentCard attachment={a} />}</For>
                    </Show>

                    <Show when={msg.reactions?.length ? msg.reactions : undefined}>
                      {(reactions) => (
                        <ReactionRow
                          reactions={reactions()}
                          onToggle={(name) =>
                            reactToMessage(props.location, props.channelId, msg, name)
                          }
                        />
                      )}
                    </Show>

                    <Show when={props.onOpenThread && (msg.replyCount ?? 0) > 0}>
                      <button
                        type="button"
                        class="message-replies"
                        onClick={() => props.onOpenThread?.(msg.ts)}
                      >
                        <Icon name="threads" size={14} /> {msg.replyCount}{" "}
                        {msg.replyCount === 1 ? "reply" : "replies"}
                      </button>
                    </Show>
                  </Show>
                </div>
              </div>
            </Show>
          </>
        );
      }}
    </For>
  );
}
