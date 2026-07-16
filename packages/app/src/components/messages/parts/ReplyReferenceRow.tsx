import { Mrkdwn } from "@slock/blockkit";
import type { Message } from "@slock/slack-api";
import { Avatar, Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import "./ReplyReferenceRow.css";

export default function ReplyReferenceRow(props: {
  message?: Message;
  onJump: () => void;
  icon?: IconName;
}) {
  const snippet = (msg: Message) => parseReplyLink(msg.text)?.rest ?? msg.text;

  return (
    <button
      class="reply-reference-row btn-reset flex-align-center"
      onClick={props.onJump}
      type="button"
    >
      <Icon name={props.icon ?? "email-reply"} size={13} />
      <Show
        fallback={<span class="reply-reference-snippet">Original message</span>}
        when={props.message}
      >
        {(msg) => (
          <>
            <Show
              fallback={
                <span class="reply-reference-avatar reply-reference-bot">
                  <Show fallback="🤖" when={msg().botIcon}>
                    {(icon) => <img alt="" class="img-cover" src={icon()} />}
                  </Show>
                </span>
              }
              when={store.users.userById(msg().userId)}
            >
              <Show when={store.users.userById(msg().userId)}>
                {(u) => <Avatar size="small" user={u()} />}
              </Show>
            </Show>
            <span class="reply-reference-name">
              {msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown"}
            </span>
            <span class="reply-reference-snippet">
              <Mrkdwn text={snippet(msg())} />
            </span>
          </>
        )}
      </Show>
    </button>
  );
}
