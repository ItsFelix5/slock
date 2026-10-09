import { BlockKitResolverContext, Mrkdwn, useBlockKitResolver } from "@slock/blockkit";
import type { Attachment, Message } from "@slock/types";
import { Avatar, Icon, type IconName } from "@slock/ui";
import { Show } from "solid-js";
import { parseSlackPermalink } from "../../../lib/navigation/slackPermalink";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import MessageLinkHoverCard, {
  attachmentToHoverPreview,
  type HoverPreview,
  messageToHoverPreview,
} from "./MessageLinkHoverCard";
import { resolveAttachmentAuthorName, resolveMessageAuthorAvatar } from "./messageAuthor";
import "./ReplyReferenceRow.css";

export default function ReplyReferenceRow(props: {
  attachment?: Attachment;
  message?: Message;
  onJump?: () => void;
  permalink?: string;
  icon?: IconName;
}) {
  const snippet = (msg: Message) =>
    (parseReplyLink(msg.text)?.rest ?? msg.text).replace(/\n+/g, " ");
  const permalinkTarget = () => (props.permalink ? parseSlackPermalink(props.permalink) : null);
  const knownPreview = (): HoverPreview | undefined => {
    if (props.message) return messageToHoverPreview(props.message);
    const { attachment } = props;
    if (!attachment?.authorName) return;
    return attachmentToHoverPreview(attachment);
  };
  const resolver = useBlockKitResolver();
  const withoutHoverCards = {
    ...resolver,
    wrapChannelMention: undefined,
    wrapLink: undefined,
    wrapUserMention: undefined,
    wrapUsergroupMention: undefined,
  };
  const contents = (
    <BlockKitResolverContext.Provider value={withoutHoverCards}>
      <Icon name={props.icon ?? "email-reply"} size={13} />
      <Show
        fallback={
          <Show fallback={<span class="truncate">Original message</span>} when={props.attachment}>
            {(attachment) => (
              <>
                <span class="reply-reference-avatar flex-center reply-reference-bot">
                  <Show fallback="💬" when={attachment().authorIcon}>
                    {(icon) => <img alt="" decoding="async" loading="lazy" src={icon()} />}
                  </Show>
                </span>
                <Show when={resolveAttachmentAuthorName(attachment(), store.users.userById)}>
                  {(name) => <span class="reply-reference-name truncate">{name()}</span>}
                </Show>
                <span class="truncate">
                  <Mrkdwn
                    inline
                    text={(attachment().text ?? attachment().title ?? "Original message").replace(
                      /\n+/g,
                      " ",
                    )}
                  />
                </span>
              </>
            )}
          </Show>
        }
        when={props.message}
      >
        {(msg) => {
          const author = () => resolveMessageAuthorAvatar(msg(), store.users.userById);
          return (
            <>
              <Avatar size="small" user={author()} />
              <span class="reply-reference-name truncate">{author().name}</span>
              <span class="truncate">
                <Mrkdwn inline text={snippet(msg())} />
              </span>
            </>
          );
        }}
      </Show>
    </BlockKitResolverContext.Provider>
  );

  return (
    <Show
      fallback={
        <button
          class="reply-reference-row btn-reset flex-align-center icon-shift"
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
          anchorClass="reply-reference-anchor"
          channelId={target().channelId}
          knownPreview={knownPreview()}
          messageTs={target().messageTs}
          threadTs={target().threadTs}
        >
          <a
            class="reply-reference-row btn-reset flex-align-center icon-shift"
            href={props.permalink}
          >
            {contents}
          </a>
        </MessageLinkHoverCard>
      )}
    </Show>
  );
}
