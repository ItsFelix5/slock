import { Mrkdwn } from "@slock/blockkit";
import type { Attachment, Message } from "@slock/slack-api";
import { Avatar, Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import "./ReplyReferenceRow.css";

const MAX_SNIPPET_CHARS = 50;

function truncateSnippet(text: string): string {
  return text.length > MAX_SNIPPET_CHARS ? `${text.slice(0, MAX_SNIPPET_CHARS)}…` : text;
}

export default function ReplyReferenceRow(props: {
  attachment?: Attachment;
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
        fallback={
          <Show
            fallback={<span class="reply-reference-snippet">Original message</span>}
            when={props.attachment}
          >
            {(attachment) => (
              <>
                <span class="reply-reference-avatar reply-reference-bot">
                  <Show fallback="💬" when={attachment().authorIcon}>
                    {(icon) => <img alt="" src={icon()} />}
                  </Show>
                </span>
                <Show when={attachment().authorName}>
                  {(name) => <span class="reply-reference-name">{name()}</span>}
                </Show>
                <span class="reply-reference-snippet">
                  <Mrkdwn
                    text={truncateSnippet(
                      attachment().text ?? attachment().title ?? "Original message",
                    )}
                  />
                </span>
              </>
            )}
          </Show>
        }
        when={props.message}
      >
        {(msg) => (
          <>
            <Avatar
              size="small"
              user={{
                avatarColor: store.users.userById(msg().userId)?.avatarColor ?? "#616061",
                avatarUrl: msg().botIcon ?? store.users.userById(msg().userId)?.avatarUrl,
                id: msg().userId,
                name: msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown",
              }}
            />
            <span class="reply-reference-name">
              {msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown"}
            </span>
            <span class="reply-reference-snippet">
              <Mrkdwn text={truncateSnippet(snippet(msg()))} />
            </span>
          </>
        )}
      </Show>
    </button>
  );
}
