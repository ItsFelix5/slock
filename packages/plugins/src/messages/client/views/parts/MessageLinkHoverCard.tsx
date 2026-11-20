import { service } from "@slock/core/solid";
import { isWaiting } from "@slock/resource";
import type { Attachment, Block, ChannelId, Ts } from "@slock/types";
import { Avatar, DEFAULT_AVATAR_COLOR, HoverCard, type useHoverIntent } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import { splitReplyLink } from "../../../../message-links/client/api/replyLink";
import { fetchPermalinkMessage } from "../../../../slack/client/api";
import MessageReferenceSnippet from "../../api/cards/MessageReferenceSnippet";
import {
  type MessageAuthorAvatarView,
  resolveAttachmentAuthorName,
  resolveMessageAuthorAvatar,
} from "../../api/messageAuthor";
import "./MessageLinkHoverCard.css";
import { defineQuery } from "../../../../query/client/api";

const usersStore = service("users");

export interface HoverPreview {
  author: MessageAuthorAvatarView;
  blocks?: Block[];
  botId?: string;
  text: string;
}

export function attachmentToHoverPreview(attachment: Attachment): HoverPreview {
  return {
    author: {
      avatarColor: DEFAULT_AVATAR_COLOR,
      avatarUrl: attachment.authorIcon,
      id: "",
      name: resolveAttachmentAuthorName(attachment, usersStore.userById) ?? "Forwarded message",
    },
    blocks: attachment.blocks,
    text: attachment.text ?? attachment.title ?? "Original message",
  };
}

export function messageToHoverPreview(
  msg: Parameters<typeof resolveMessageAuthorAvatar>[0] & {
    blocks?: Block[];
    text: string;
    attachments?: Attachment[];
  },
): HoverPreview {
  const { blocks, text } = splitReplyLink(msg);
  const forward =
    blocks || text.trim() ? undefined : msg.attachments?.find((a) => a.isMessageUnfurl);
  if (forward) return attachmentToHoverPreview(forward);
  return {
    author: resolveMessageAuthorAvatar(msg, usersStore.userById),
    blocks,
    botId: msg.botId,
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
              <div class="message-link-hovercard-text text-sm truncate-lines">
                <MessageReferenceSnippet
                  blocks={p().blocks}
                  botId={p().botId}
                  botUserId={p().author.id}
                  channelId={props.channelId}
                  text={p().text}
                  threadTs={props.threadTs}
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
