import {
  type ReplyTarget,
  splitReplyLink,
  threadContainsMessage,
} from "@slock/plugins/message-links/client/api/replyLink";
import type { Attachment, Block, ChannelId, Message, Ts } from "@slock/types";
import { isBareLinkUnfurl } from "../api/messageAuthor";
import { emojiOnlyBlockMessage, emojiShortcodeCount, MAX_ENLARGED_EMOJI } from "./emojiOnlyMessage";
import { isUnreadDividerBoundary } from "./unreadDivider";

interface MessageContentContext {
  channelId: ChannelId;
  hasOpenThread: boolean;
  messages: () => Message[];
  threadTs?: Ts;
}

export interface MessageContent {
  hasEnlargedEmojiOnlyText: boolean;
  messageText: string;
  renderBlocks: Block[] | undefined;
  replyRef: ReplyTarget | null;
  showBroadcastBadge: boolean;
  showThreadContext: boolean;
  visibleAttachments: Attachment[] | undefined;
}

interface MessageNeighborContext {
  channelId: ChannelId;
  isPinned: boolean;
  messages: () => Message[];
  showDeleted: boolean;
  threadTs?: Ts;
  unreadDividerTs?: number;
}

interface MessageNeighborState {
  dayChanged: boolean;
  repliesCount: number;
  repliesDividerDay: string | undefined;
  sameAuthorAsPrev: boolean;
  showMessage: boolean;
  showRepliesDivider: boolean;
  showUnreadDivider: boolean;
}

export function resolveMessageContent(
  message: Message,
  context: MessageContentContext,
): MessageContent {
  const isThreadMessage = (channelId: ChannelId, ts: Ts) =>
    threadContainsMessage(context.channelId, message.threadTs, context.messages(), channelId, ts);
  const {
    blocks: renderBlocks,
    replyRef,
    text: messageText,
  } = splitReplyLink(message, isThreadMessage);

  const enlargedEmojiCount = renderBlocks
    ? emojiOnlyBlockMessage(renderBlocks)
    : (() => {
        const count = emojiShortcodeCount(messageText);
        return count !== undefined && count > 0 && count < MAX_ENLARGED_EMOJI ? count : 0;
      })();

  return {
    hasEnlargedEmojiOnlyText: enlargedEmojiCount > 0,
    messageText,
    renderBlocks,
    replyRef,
    showBroadcastBadge: !context.hasOpenThread && !!message.isBroadcast && !!message.threadTs,
    showThreadContext: context.hasOpenThread && !!message.isBroadcast && !!message.threadTs,
    visibleAttachments: message.attachments?.filter(
      (attachment) =>
        !(
          (attachment.isMessageUnfurl && attachment.ts === replyRef?.ts) ||
          isBareLinkUnfurl(attachment)
        ),
    ),
  };
}

export function resolveMessageNeighbors(
  message: Message,
  prev: Message | undefined,
  content: Pick<MessageContent, "replyRef" | "showBroadcastBadge" | "showThreadContext">,
  context: MessageNeighborContext,
): MessageNeighborState {
  const isThreadRoot = !!context.threadTs && message.ts === context.threadTs;

  const isFirstReply = !!context.threadTs && !!prev && prev.ts === context.threadTs;
  const dayChangedRaw = isThreadRoot ? message.day !== "Today" : !prev || prev.day !== message.day;
  const dayChanged = isThreadRoot || isFirstReply ? false : dayChangedRaw;
  const isFirstRow = isThreadRoot && !prev;
  const messages = isFirstRow ? context.messages() : [];
  const rootIndex = messages.findIndex((candidate) => candidate.ts === message.ts);
  const repliesCount = Math.max(message.replyCount ?? 0, messages.length - rootIndex - 1);
  const showRepliesDivider = isFirstRow && repliesCount > 0;
  const firstReply = showRepliesDivider ? messages[rootIndex + 1] : undefined;
  const repliesDividerDay = firstReply?.day;
  const showUnreadDivider =
    !context.threadTs &&
    context.unreadDividerTs != null &&
    isUnreadDividerBoundary(message.ts, prev?.ts, context.unreadDividerTs);
  const sameAuthorAsPrev =
    !!prev &&
    prev.userId === message.userId &&
    prev.botName === message.botName &&
    prev.botIcon === message.botIcon &&
    !dayChangedRaw &&
    prev.kind === message.kind &&
    !context.isPinned &&
    !content.replyRef &&
    !content.showThreadContext &&
    !content.showBroadcastBadge;

  return {
    dayChanged,
    repliesCount,
    repliesDividerDay,
    sameAuthorAsPrev,
    showMessage: !message.deleted || context.showDeleted,
    showRepliesDivider,
    showUnreadDivider,
  };
}
