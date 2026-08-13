import { Mrkdwn } from "@slock/blockkit";
import type { Attachment, Message } from "@slock/slack-api";
import { Avatar, DEFAULT_AVATAR_COLOR, Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import { parseSlackPermalink } from "../../../lib/navigation/slackPermalink";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import MessageLinkHoverCard from "./MessageLinkHoverCard";
import "./ReplyReferenceRow.css";

export default function ReplyReferenceRow(props: {
  attachment?: Attachment;
  message?: Message;
  onJump?: () => void;
  permalink?: string;
  icon?: IconName;
}) {
  const snippet = (msg: Message) => parseReplyLink(msg.text)?.rest ?? msg.text;
  const permalinkTarget = () => (props.permalink ? parseSlackPermalink(props.permalink) : null);
  const contents = (
    <>
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
                  <Mrkdwn text={attachment().text ?? attachment().title ?? "Original message"} />
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
                avatarColor:
                  store.users.userById(msg().userId)?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                avatarUrl: msg().botIcon ?? store.users.userById(msg().userId)?.avatarUrl,
                id: msg().userId,
                name: msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown",
              }}
            />
            <span class="reply-reference-name">
              {msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown"}
            </span>
            <span class="reply-reference-snippet">
              <Mrkdwn text={snippet(msg())} />
            </span>
          </>
        )}
      </Show>
    </>
  );

  return (
    <Show
      fallback={
        <button
          class="reply-reference-row btn-reset flex-align-center"
          onClick={props.onJump}
          type="button"
        >
          {contents}
        </button>
      }
      when={permalinkTarget()}
    >
      {(target) => (
        <MessageLinkHoverCard
          channelId={target().channelId}
          messageTs={target().messageTs}
          threadTs={target().threadTs}
        >
          <a class="reply-reference-row btn-reset flex-align-center" href={props.permalink}>
            {contents}
          </a>
        </MessageLinkHoverCard>
      )}
    </Show>
  );
}
