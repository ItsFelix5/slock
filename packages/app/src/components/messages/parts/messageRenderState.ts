import type { Attachment, Block, Message } from "@slock/types";
import {
  parseReplyLink,
  parseReplyLinkFromBlocks,
  threadContainsMessage,
} from "../../../lib/replyLink";
import { isUnreadDividerBoundary } from "../lib/unreadDivider";
import { emojiOnlyBlockMessage, emojiShortcodeCount, MAX_ENLARGED_EMOJI } from "./emojiOnlyMessage";
import { isBareLinkUnfurl } from "./messageAuthor";

export interface MessageRenderContext {
  channelId: string;
  hasOpenThread: boolean;
  isPinned: boolean;
  messages: Message[];
  showDeleted: boolean;
  threadTs?: string;
  unreadDividerTs?: number;
}

export interface MessageRenderState {
  dayChanged: boolean;
  enlargedEmojiCount: number;
  hasEnlargedEmojiOnlyText: boolean;
  messageText: string;
  renderBlocks: Block[] | undefined;
  replyRef: ReturnType<typeof parseReplyLink>;
  repliesDividerDay: string | undefined;
  sameAuthorAsPrev: boolean;
  showMessage: boolean;
  showBroadcastBadge: boolean;
  showRepliesDivider: boolean;
  showThreadContext: boolean;
  showUnreadDivider: boolean;
  visibleAttachments: Attachment[] | undefined;
}

export function resolveMessageRenderState(
  message: Message,
  prev: Message | undefined,
  context: MessageRenderContext,
): MessageRenderState {
  const isThreadRoot = !!context.threadTs && message.ts === context.threadTs;

  const isFirstReply = !!context.threadTs && !!prev && prev.ts === context.threadTs;
  const dayChangedRaw = isThreadRoot ? message.day !== "Today" : !prev || prev.day !== message.day;
  const dayChanged = isThreadRoot || isFirstReply ? false : dayChangedRaw;
  const showRepliesDivider = isThreadRoot && !prev && (message.replyCount ?? 0) > 0;
  const firstReply = showRepliesDivider
    ? context.messages[context.messages.findIndex((candidate) => candidate.ts === message.ts) + 1]
    : undefined;
  const repliesDividerDay =
    firstReply && firstReply.day !== message.day ? firstReply.day : undefined;
  const showUnreadDivider =
    !context.threadTs &&
    context.unreadDividerTs != null &&
    isUnreadDividerBoundary(message.ts, prev?.ts, context.unreadDividerTs);
  const parsedTextReplyRef = parseReplyLink(message.text, (channelId, ts) =>
    threadContainsMessage(context.channelId, message.threadTs, context.messages, channelId, ts),
  );
  const textReplyRef =
    parsedTextReplyRef?.channelId === context.channelId ? parsedTextReplyRef : null;

  const parsedBlockReplyRef =
    !textReplyRef && message.blocks?.length ? parseReplyLinkFromBlocks(message.blocks) : undefined;
  const blockReplyRef =
    parsedBlockReplyRef?.channelId === context.channelId ? parsedBlockReplyRef : undefined;
  const replyRef =
    textReplyRef ??
    (blockReplyRef
      ? {
          channelId: blockReplyRef.channelId,
          prefix: "",

          rest: "",
          ts: blockReplyRef.ts,
          url: blockReplyRef.url,
        }
      : null);
  const messageText = replyRef?.rest ?? message.text;

  const rawRenderBlocks = textReplyRef ? undefined : (blockReplyRef?.blocks ?? message.blocks);
  const renderBlocks = rawRenderBlocks?.length ? rawRenderBlocks : undefined;
  const showThreadContext = context.hasOpenThread && !!message.isBroadcast && !!message.threadTs;

  const showBroadcastBadge = !context.hasOpenThread && !!message.isBroadcast && !!message.threadTs;
  const sameAuthorAsPrev =
    !!prev &&
    prev.userId === message.userId &&
    prev.botName === message.botName &&
    prev.botIcon === message.botIcon &&
    !dayChangedRaw &&
    prev.kind === message.kind &&
    !context.isPinned &&
    !replyRef &&
    !showThreadContext &&
    !showBroadcastBadge;

  const enlargedEmojiCount = message.blocks?.length
    ? emojiOnlyBlockMessage(message.blocks)
    : (() => {
        const count = emojiShortcodeCount(messageText);
        return count !== undefined && count > 0 && count < MAX_ENLARGED_EMOJI ? count : 0;
      })();

  return {
    dayChanged,
    enlargedEmojiCount,
    hasEnlargedEmojiOnlyText: enlargedEmojiCount > 0,
    messageText,
    renderBlocks,
    replyRef,
    repliesDividerDay,
    sameAuthorAsPrev,
    showBroadcastBadge,
    showMessage: !message.deleted || context.showDeleted,
    showRepliesDivider,
    showThreadContext,
    showUnreadDivider,
    visibleAttachments: message.attachments?.filter(
      (attachment) =>
        !(
          (attachment.isMessageUnfurl && attachment.ts === replyRef?.ts) ||
          isBareLinkUnfurl(attachment)
        ),
    ),
  };
}
