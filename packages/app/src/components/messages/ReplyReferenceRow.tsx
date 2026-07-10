import { Mrkdwn } from "@slock/blockkit";
import type { Message } from "@slock/slack-api";
import { Avatar, Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import { parseReplyLink } from "../../lib/replyLink";
import { userById } from "../../lib/store";
import "./ReplyReferenceRow.css";

export default function ReplyReferenceRow(props: {
  message?: Message;
  onJump: () => void;
  icon?: IconName;
}) {
  const snippet = (msg: Message) => parseReplyLink(msg.text)?.rest ?? msg.text;

  return (
    <button type="button" class="reply-reference-row" onClick={props.onJump}>
      <Icon name={props.icon ?? "email-reply"} size={13} />
      <Show
        when={props.message}
        fallback={<span class="reply-reference-snippet">Original message</span>}
      >
        {(msg) => (
          <>
            <Show
              when={!msg().botName}
              fallback={
                <span class="reply-reference-avatar reply-reference-bot">
                  <Show when={msg().botIcon} fallback="🤖">
                    {(icon) => <img src={icon()} alt="" />}
                  </Show>
                </span>
              }
            >
              <Show when={userById(msg().userId)}>{(u) => <Avatar user={u()} size="small" />}</Show>
            </Show>
            <span class="reply-reference-name">
              {msg().botName ?? userById(msg().userId)?.name ?? "Unknown"}
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
