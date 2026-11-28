import { service } from "@slock/core/solid";
import { splitReplyLink } from "@slock/plugins/message-links/client/api/replyLink";
import { fetchPermalinkMessage } from "@slock/plugins/slack/client/api";
import { isWaiting } from "@slock/resource";
import type { Attachment, ChannelId, TeamId, Ts } from "@slock/types";
import { Avatar, DEFAULT_AVATAR_COLOR, HoverCard, type useHoverIntent } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import MessageReferenceSnippet from "../../api/cards/MessageReferenceSnippet";
import {
  type MessageAuthorAvatarView,
  resolveAttachmentAuthorName,
  resolveMessageAuthorAvatar,
} from "../../api/messageAuthor";
import { attachmentContent, type PreviewContent } from "../../api/preview/previewContent";
import "./MessageLinkHoverCard.css";
import { defineQuery } from "@slock/plugins/query/client/api";

const usersStore = service("users");

export interface HoverPreview extends PreviewContent {
  author: MessageAuthorAvatarView;
  botId?: string;
  botTeamId?: TeamId;
}

export function attachmentToHoverPreview(attachment: Attachment): HoverPreview {
  return {
    ...attachmentContent(attachment),
    author: {
      avatarColor: DEFAULT_AVATAR_COLOR,
      avatarUrl: attachment.authorIcon,
      id: "",
      name: resolveAttachmentAuthorName(attachment, usersStore.userById) ?? "Forwarded message",
    },
  };
}

export function messageToHoverPreview(
  msg: Parameters<typeof resolveMessageAuthorAvatar>[0] & PreviewContent,
): HoverPreview {
  const { blocks, text } = splitReplyLink(msg);
  const forward =
    blocks || text.trim() ? undefined : msg.attachments?.find((a) => a.isMessageUnfurl);
  if (forward) return attachmentToHoverPreview(forward);
  return {
    attachments: msg.attachments,
    author: resolveMessageAuthorAvatar(msg, usersStore.userById),
    blocks,
    botId: msg.botId,
    botTeamId: msg.botTeamId,
    files: msg.files,
    text,
  };
}

interface PreviewRef {
  channelId: ChannelId;
  messageTs: Ts;
  threadTs: Ts;
}

const messageLinkPreview = defineQuery<PreviewRef, HoverPreview | null>({
  load: async ({ channelId, messageTs, threadTs }) => {
    const msg = await fetchPermalinkMessage(channelId, messageTs, threadTs);
    return msg ? messageToHoverPreview(msg) : null;
  },
  name: "messageLinkPreview",
});

export default function MessageLinkHoverCard(props: {
  channelId: ChannelId;
  messageTs: Ts;
  threadTs: Ts;
  anchorClass?: string;
  knownPreview?: HoverPreview;
  children?: JSX.Element;
  anchor?: () => HTMLElement | undefined;
  hoverIntent?: ReturnType<typeof useHoverIntent>;
}) {
  const [open, setOpen] = createSignal(false);

  const fetched = messageLinkPreview.state(() => {
    if (!open() || props.knownPreview) return;
    const { channelId, messageTs, threadTs } = props;
    return { channelId, messageTs, threadTs };
  });
  const preview = () => props.knownPreview ?? fetched().data ?? undefined;

  return (
    <HoverCard
      anchorClass={props.anchorClass}
      anchor={props.anchor}
      hoverIntent={props.hoverIntent}
      content={() => (
        <Show
          fallback={
            <div class="message-link-hovercard-status text-dim text-sm">
              {isWaiting(fetched()) ? "Loading message…" : "Message unavailable"}
            </div>
          }
          when={preview()}
        >
          {(p) => (
            <>
              <div class="message-link-hovercard-head flex-align-center">
                <Avatar size="small" user={p().author} />
                <span class="message-link-hovercard-name">{p().author.name}</span>
              </div>
              <div class="message-link-hovercard-text text-sm">
                <MessageReferenceSnippet
                  attachments={p().attachments}
                  blocks={p().blocks}
                  botId={p().botId}
                  botTeamId={p().botTeamId}
                  botUserId={p().author.id}
                  channelId={props.channelId}
                  files={p().files}
                  text={p().text}
                  textClass="truncate-lines"
                  threadTs={props.threadTs}
                  thumbnails
                  ts={props.messageTs}
                />
              </div>
            </>
          )}
        </Show>
      )}
      onOpenChange={setOpen}
      panelClass="message-link-hovercard"
      width={320}
    >
      {props.children}
    </HoverCard>
  );
}
