import { EmojiText } from "@slock/blockkit";
import type { Message, User } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { type Accessor, Show } from "solid-js";
import UserHoverCard from "../user/UserHoverCard";
import { MessageAuthorButton } from "./MessageAuthorButtons";

export default function MessageMeta(props: {
  message: Message;
  user: Accessor<User | undefined>;
  displayName: () => string;
  onOpenUser: () => void;
}) {
  const msg = props.message;
  return (
    <div class="message-meta">
      <Show
        fallback={<MessageAuthorButton disabled name={props.displayName()} onClick={() => {}} />}
        when={!msg.botName}
      >
        <UserHoverCard userId={msg.userId}>
          <MessageAuthorButton
            disabled={false}
            name={props.displayName()}
            onClick={props.onOpenUser}
          />
        </UserHoverCard>
      </Show>
      <Show when={props.user()?.statusEmoji}>
        {(emoji) => (
          <span class="message-status-emoji">
            <EmojiText text={emoji()} />
            <Show when={props.user()?.statusText}>
              <span class="message-status-tooltip">{props.user()?.statusText}</span>
            </Show>
          </span>
        )}
      </Show>
      <Show when={msg.botName}>
        &nbsp;<span class="message-bot-badge">APP</span>
      </Show>
      <Show when={msg.kind === "system"}>
        &nbsp;<span class="message-bot-badge">System</span>
      </Show>
      <span class="message-time">{msg.time}</span>
      <Show when={props.user()?.pronouns}>
        <span class="pronouns">•&nbsp;{props.user()?.pronouns}</span>
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

      <Show when={msg.isBroadcast}>
        <span class="message-edited">&nbsp;sent to channel</span>
      </Show>
    </div>
  );
}
