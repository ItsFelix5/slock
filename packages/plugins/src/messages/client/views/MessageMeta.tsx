import { EmojiFreezeContext, EmojiText } from "@slock/blockkit";
import { Slot, usePoint } from "@slock/core/solid";
import type { Message, User } from "@slock/types";
import { Icon, Tooltip, useElementVisible } from "@slock/ui";
import { type Accessor, mapArray, Show } from "solid-js";
import { MessageAuthorButton } from "../api/cards/MessageAuthorButton";
import { isRealUserId } from "../api/messageAuthor";
import AuthorHoverCard from "./parts/AuthorHoverCard";

export default function MessageMeta(props: {
  message: Message;
  user: Accessor<User | undefined>;
  channelId: string;
  displayName: () => string;
  threadTs?: string;
  botUserId?: string;
  onOpenBot: () => void;
  onOpenUser: () => void;
  showBroadcastBadge?: () => boolean;
  tabbable?: () => boolean;
  userId?: string;
}) {
  const msg = props.message;
  const { ref: visibleRef, visible } = useElementVisible();
  const authorClasses = mapArray(usePoint("messages.author"), (authorClass) =>
    authorClass({
      user: props.user,
      userId: () => (isRealUserId(props.userId) ? props.userId : undefined),
      visible,
    }),
  );
  const authorClass = () =>
    authorClasses()
      .map((read) => read())
      .filter(Boolean)
      .join(" ");
  return (
    <div class="message-meta icon-shift" ref={visibleRef}>
      <Show
        fallback={<MessageAuthorButton disabled name={props.displayName()} onClick={() => {}} />}
        when={props.userId}
      >
        {(userId) => (
          <AuthorHoverCard userId={userId()}>
            <MessageAuthorButton
              class={authorClass()}
              disabled={false}
              name={props.displayName()}
              onClick={props.onOpenUser}
              tabbable={props.tabbable?.()}
            />
          </AuthorHoverCard>
        )}
      </Show>
      <Show when={props.user()?.statusEmoji}>
        {(emoji) => (
          <Tooltip
            content={
              props.user()?.statusText && <EmojiText text={props.user()?.statusText ?? ""} />
            }
          >
            <span class="message-status-emoji">
              <EmojiFreezeContext.Provider value={() => true}>
                <EmojiText text={emoji()} />
              </EmojiFreezeContext.Provider>
            </span>
          </Tooltip>
        )}
      </Show>
      <Show when={msg.botName || props.botUserId || props.user()?.isBot}>
        <Show fallback={<span class="message-bot-badge">APP</span>} when={props.botUserId}>
          {(botUserId) => (
            <AuthorHoverCard userId={botUserId()}>
              <button class="message-bot-badge btn-reset" onClick={props.onOpenBot} type="button">
                APP
              </button>
            </AuthorHoverCard>
          )}
        </Show>
      </Show>
      <Show when={msg.kind === "system"}>
        <span class="message-bot-badge">System</span>
      </Show>
      <Tooltip content={`${msg.day} at ${msg.time}`}>
        <span class="message-time meta-dim">{msg.time}</span>
      </Tooltip>
      <Show when={props.user()?.pronouns}>
        <span class="pronouns truncate">• {props.user()?.pronouns}</span>
      </Show>
      <Show when={msg.isEphemeral}>
        <span class="message-ephemeral-badge">
          <Icon name="eye-closed" size={11} />
          Only visible to you
        </span>
      </Show>
      <Slot
        channelId={props.channelId}
        message={msg}
        point="messages.badge"
        showBroadcast={!!props.showBroadcastBadge?.()}
        threadTs={props.threadTs}
      />
    </div>
  );
}
