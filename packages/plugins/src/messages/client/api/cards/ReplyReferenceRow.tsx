import { BlockKitResolverContext, useBlockKitResolver } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { splitReplyLink } from "@slock/plugins/message-links/client/api/replyLink";
import { parseSlackPermalink } from "@slock/plugins/message-links/client/api/slackPermalink";
import type { Attachment, Message } from "@slock/types";
import { Avatar, Icon, type IconName, imageSrc } from "@slock/ui";
import { Show } from "solid-js";
import MessageLinkHoverCard, {
  attachmentToHoverPreview,
  type HoverPreview,
  messageToHoverPreview,
} from "../../views/parts/MessageLinkHoverCard";
import { resolveAttachmentAuthorName, resolveMessageAuthorAvatar } from "../messageAuthor";
import MessagePreviewText from "../preview/MessagePreviewText";
import { attachmentContent } from "../preview/previewContent";
import "./ReplyReferenceRow.css";

const usersStore = service("users");

export default function ReplyReferenceRow(props: {
  attachment?: Attachment;
  message?: Message;
  onJump?: () => void;
  permalink?: string;
  icon?: IconName;
  newerReplies?: boolean;
}) {
  const oneLine = (text: string) => text.replace(/\n+/g, " ");
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
    <BlockKitResolverContext value={withoutHoverCards}>
      <Icon name={props.icon ?? "email-reply"} size={13} />
      <Show when={props.newerReplies}>
        <span class="reply-reference-newer" />
      </Show>
      <Show
        fallback={
          <Show fallback={<span class="truncate">Original message</span>} when={props.attachment}>
            {(attachment) => (
              <>
                <span class="reply-reference-avatar flex-center reply-reference-bot">
                  <Show fallback="💬" when={attachment().authorIcon}>
                    {(icon) => (
                      <img alt="" decoding="async" loading="lazy" src={imageSrc(icon())} />
                    )}
                  </Show>
                </span>
                <Show when={resolveAttachmentAuthorName(attachment(), usersStore.userById)}>
                  {(name) => <span class="reply-reference-name truncate">{name()}</span>}
                </Show>
                <span class="truncate">
                  <MessagePreviewText
                    {...attachmentContent(attachment())}
                    inline
                    text={oneLine(attachment().text ?? "")}
                  />
                </span>
              </>
            )}
          </Show>
        }
        when={props.message}
      >
        {(msg) => {
          const author = () => resolveMessageAuthorAvatar(msg(), usersStore.userById);
          return (
            <>
              <Avatar size="small" user={author()} />
              <span class="reply-reference-name truncate">{author().name}</span>
              <span class="truncate">
                <MessagePreviewText
                  attachments={msg().attachments}
                  blocks={splitReplyLink(msg()).blocks}
                  files={msg().files}
                  inline
                  text={oneLine(splitReplyLink(msg()).text)}
                />
              </span>
            </>
          );
        }}
      </Show>
    </BlockKitResolverContext>
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
