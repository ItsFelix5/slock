import { EmojiText } from "@slock/blockkit";
import type { Message, User } from "@slock/slack-api";
import { Icon, Tooltip } from "@slock/ui";
import { type Accessor, Show } from "solid-js";
import UserHoverCard from "../user/UserHoverCard";
import { MessageAuthorButton } from "./MessageAuthorButtons";

export default function MessageMeta(props: {
  message: Message;
  user: Accessor<User | undefined>;
  displayName: () => string;
  isPinned: () => boolean;
  onOpenUser: () => void;
  userId?: string;
}) {
  const msg = props.message;
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
      <Show when={msg.botName || props.user()?.isBot}>
        <span class="message-bot-badge">APP</span>
      </Show>
      <Show when={msg.kind === "system"}>
        <span class="message-bot-badge">System</span>
      </Show>
      <span class="message-time">{msg.time}</span>
      <Show when={props.user()?.pronouns}>
        <span class="pronouns">• {props.user()?.pronouns}</span>
      </Show>
      <Show when={msg.isEphemeral}>
        <span class="message-ephemeral-badge">
          <Icon name="eye-closed" size={11} />
          Only visible to you
        </span>
      </Show>
      <Show when={msg.isSaved}>
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
    </div>
  );
}
