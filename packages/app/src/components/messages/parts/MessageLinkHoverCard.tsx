import { Mrkdwn } from "@slock/blockkit";
import type { Attachment } from "@slock/types";
import { Avatar, DEFAULT_AVATAR_COLOR, HoverCard, type useHoverIntent } from "@slock/ui";
import { createResource, createSignal, type JSX, Show } from "solid-js";
import { fetchPermalinkMessage } from "../../../lib/api";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import {
  type MessageAuthorAvatarView,
  resolveAttachmentAuthorName,
  resolveMessageAuthorAvatar,
} from "./messageAuthor";
import "./MessageLinkHoverCard.css";

export interface HoverPreview {
  author: MessageAuthorAvatarView;
  text: string;
}

export function attachmentToHoverPreview(attachment: Attachment): HoverPreview {
  return {
    author: {
      avatarColor: DEFAULT_AVATAR_COLOR,
      avatarUrl: attachment.authorIcon,
      id: "",
      name: resolveAttachmentAuthorName(attachment, store.users.userById) ?? "Forwarded message",
    },
    text: (attachment.text ?? attachment.title ?? "Original message").replace(/\n+/g, " "),
  };
}

export function messageToHoverPreview(
  msg: Parameters<typeof resolveMessageAuthorAvatar>[0] & {
    text: string;
    attachments?: Attachment[];
  },
): HoverPreview {
  const text = parseReplyLink(msg.text)?.rest ?? msg.text;
  const forward = text.trim() ? undefined : msg.attachments?.find((a) => a.isMessageUnfurl);
  if (forward) return attachmentToHoverPreview(forward);
  return { author: resolveMessageAuthorAvatar(msg, store.users.userById), text };
}

export default function MessageLinkHoverCard(props: {
  channelId: string;
  messageTs: string;
  threadTs: string;
  anchorClass?: string;
  knownPreview?: HoverPreview;
  children?: JSX.Element;
  anchor?: () => HTMLElement | undefined;
  hoverIntent?: ReturnType<typeof useHoverIntent>;
}) {
  const [open, setOpen] = createSignal(false);

  const [fetched] = createResource(
    () => (open() && !props.knownPreview ? props : undefined),
    async (p) => {
      const msg = await fetchPermalinkMessage(p.channelId, p.messageTs, p.threadTs).catch(
        () => undefined,
      );
      return msg ? messageToHoverPreview(msg) : undefined;
    },
  );
  const preview = () => props.knownPreview ?? fetched();

  return (
    <HoverCard
      anchorClass={props.anchorClass}
      anchor={props.anchor}
      hoverIntent={props.hoverIntent}
      content={() => (
        <Show
          fallback={
            <div class="message-link-hovercard-status text-dim text-sm">
              {fetched.loading ? "Loading message…" : "Message unavailable"}
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
                <Mrkdwn text={p().text} />
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
