import { EmojiText } from "@slock/blockkit";
import { fetchUserStatus, type Message, type User } from "@slock/slack-api";
import { Icon, Tooltip } from "@slock/ui";
import { type Accessor, createResource, Show } from "solid-js";
import UserHoverCard from "../user/UserHoverCard";
import { MessageAuthorButton } from "./message-author-buttons";
import { isRealUserId } from "./parts/messageRenderState";

export default function MessageMeta(props: {
  message: Message;
  user: Accessor<User | undefined>;
  displayName: () => string;
  isPinned: () => boolean;
  botUserId?: string;
  onOpenBot: () => void;
  onOpenUser: () => void;
  showBroadcastBadge?: () => boolean;
  tabbable?: () => boolean;
  userId?: string;
}) {
  const msg = props.message;
  const [status] = createResource(
    () => {
      const user = props.user();
      return isRealUserId(props.userId) && user && !user.isBot ? props.userId : undefined;
    },
    (userId) => fetchUserStatus(userId).catch(() => undefined),
  );
  return (
    <div class="message-meta">
      <Show
        fallback={<MessageAuthorButton disabled name={props.displayName()} onClick={() => {}} />}
        when={props.userId}
      >
        {(userId) => (
          <UserHoverCard userId={userId()}>
            <MessageAuthorButton
              disabled={false}
              name={props.displayName()}
              onClick={props.onOpenUser}
              status={status()}
              tabbable={props.tabbable?.()}
            />
          </UserHoverCard>
        )}
      </Show>
      <Show when={props.user()?.statusEmoji}>
        {(emoji) => (
          <Tooltip content={props.user()?.statusText}>
            <span class="message-status-emoji">
              <EmojiText text={emoji()} />
            </span>
          </Tooltip>
        )}
      </Show>
      <Show when={msg.botName || props.botUserId || props.user()?.isBot}>
        <Show fallback={<span class="message-bot-badge">APP</span>} when={props.botUserId}>
          {(botUserId) => (
            <UserHoverCard userId={botUserId()}>
              <button class="message-bot-badge btn-reset" onClick={props.onOpenBot} type="button">
                APP
              </button>
            </UserHoverCard>
          )}
        </Show>
      </Show>
      <Show when={msg.kind === "system"}>
        <span class="message-bot-badge">System</span>
      </Show>
      <Tooltip content={`${msg.day} at ${msg.time}`}>
        <span class="message-time">{msg.time}</span>
      </Tooltip>
      <Show when={props.user()?.pronouns}>
        <span class="pronouns">• {props.user()?.pronouns}</span>
      </Show>
      <Show when={msg.isEphemeral}>
        <span class="message-ephemeral-badge">
          <Icon name="eye-closed" size={11} />
          Only visible to you
        </span>
      </Show>
      <Show when={props.message.isSaved}>
        <span class="message-saved-badge">
          <Icon name="bookmark-filled" size={11} />
          Saved
        </span>
      </Show>
      <Show when={props.isPinned()}>
        <span class="message-pinned-badge">
          <Icon name="pin-filled" size={11} />
          Pinned
        </span>
      </Show>
      <Show when={props.showBroadcastBadge?.()}>
        <span class="message-broadcast-badge">
          <Icon name="channel" size={11} />
          Also sent to channel
        </span>
      </Show>
    </div>
  );
}
