import { DEFAULT_AVATAR_COLOR } from "@slock/ui";
import type {
  Attachment,
  Block,
  Message,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
  TextObject,
} from "../../../lib/api";
import {
  parseReplyLink,
  parseReplyLinkFromBlocks,
  threadContainsMessage,
} from "../../../lib/replyLink";
import { isUnreadDividerBoundary } from "../lib/unreadDivider";

const USER_PROFILE_ID_RE = /^[UW]/;
const BOT_PROFILE_ID_RE = /^B/;
const RICH_TEXT_SUB_BLOCK_TYPES = new Set<RichTextSubBlock["type"]>([
  "rich_text_section",
  "rich_text_list",
  "rich_text_preformatted",
  "rich_text_quote",
]);
export function isRichTextSubBlock(
  element: RichTextInlineElement | RichTextSubBlock,
): element is RichTextSubBlock {
  return RICH_TEXT_SUB_BLOCK_TYPES.has(element.type as RichTextSubBlock["type"]);
}

export function resolveBotProfileUserId(
  msg: Pick<Message, "botId" | "botName" | "userId">,
): string | undefined {
  if (BOT_PROFILE_ID_RE.test(msg.botId ?? "")) return msg.botId;
  if (msg.botName === "Slackbot") return "USLACKBOT";
  return msg.botName && (USER_PROFILE_ID_RE.test(msg.userId) || BOT_PROFILE_ID_RE.test(msg.userId))
    ? msg.userId
    : undefined;
}

export function resolveProfileUserId(
  msg: Pick<Message, "botId" | "botName" | "sourceUserId" | "userId">,
): string | undefined {
  if ((msg.botId || msg.botName) && USER_PROFILE_ID_RE.test(msg.sourceUserId ?? "")) {
    return msg.sourceUserId;
  }
  if (USER_PROFILE_ID_RE.test(msg.userId)) return msg.userId;
  return resolveBotProfileUserId(msg);
}

export function isRealUserId(id: string | undefined): id is string {
  return !!id && USER_PROFILE_ID_RE.test(id);
}

export interface MessageAuthorFields {
  botIcon?: string;
  botId?: string;
  botName?: string;
  sourceUserId?: string;
  userId: string;
}

export function hasRealMessageAuthor(msg: MessageAuthorFields): boolean {
  return (
    ((msg.botId || msg.botName) && USER_PROFILE_ID_RE.test(msg.sourceUserId ?? "")) ||
    (!!msg.userId && msg.userId !== msg.botId)
  );
}

export function resolveAuthorDisplayName(
  msg: MessageAuthorFields,
  userName: string | undefined,
  fallback: string,
): string {
  return (hasRealMessageAuthor(msg) ? userName : (msg.botName ?? userName)) ?? fallback;
}

export function unresolvedAuthorFallback(msg: Pick<MessageAuthorFields, "userId">): string {
  return msg.userId ? "Loading…" : "Someone";
}

export function resolveAuthorAvatarUrl(
  msg: MessageAuthorFields,
  userAvatarUrl: string | undefined,
): string | undefined {
  return hasRealMessageAuthor(msg) ? userAvatarUrl : (msg.botIcon ?? userAvatarUrl);
}

export interface MessageAuthorAvatarView {
  avatarColor: string;
  avatarUrl: string | undefined;
  id: string;
  name: string;
}

export function resolveMessageAuthorAvatar(
  msg: MessageAuthorFields,
  userById: (id: string) => { avatarColor?: string; avatarUrl?: string; name: string } | undefined,
): MessageAuthorAvatarView {
  const user = hasRealMessageAuthor(msg) ? userById(msg.userId) : undefined;
  return {
    avatarColor: user?.avatarColor ?? DEFAULT_AVATAR_COLOR,
    avatarUrl: resolveAuthorAvatarUrl(msg, user?.avatarUrl),
    id: msg.userId,
    name: resolveAuthorDisplayName(msg, user?.name, "Unknown"),
  };
}

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

const EMOJI_SHORTCODE_RE = /:([a-z0-9_+'-]+):/gi;
const MAX_ENLARGED_EMOJI = 25;

function emojiShortcodeCount(text: string): number | undefined {
  const emoji = text.match(EMOJI_SHORTCODE_RE);
  return text.replace(EMOJI_SHORTCODE_RE, "").trim() ? undefined : (emoji?.length ?? 0);
}

function emojiOnlyRichTextCount(block: RichTextBlock): number | undefined {
  let count = 0;
  const addElements = (elements: RichTextInlineElement[]) => {
    for (const element of elements) {
      if (element.type === "emoji") count += 1;
      else if (element.type === "text") {
        const textCount = emojiShortcodeCount(element.text);
        if (textCount === undefined) return false;
        count += textCount;
      } else return false;
    }
    return true;
  };
  const addSubBlock = (subBlock: RichTextSubBlock) => {
    if (subBlock.type === "rich_text_list")
      return subBlock.elements.every((section) => addElements(section.elements));

    if (subBlock.elements.some(isRichTextSubBlock)) return false;
    return addElements(subBlock.elements as RichTextInlineElement[]);
  };

  return block.elements.every(addSubBlock) ? count : undefined;
}

function emojiOnlyBlockMessage(blocks: Block[]): number {
  let count = 0;
  const addText = (text: TextObject | undefined) => {
    if (!text) return false;
    const textCount = emojiShortcodeCount(text.text);
    if (textCount === undefined) return false;
    count += textCount;
    return true;
  };

  for (const block of blocks) {
    if (block.type === "rich_text") {
      const richTextCount = emojiOnlyRichTextCount(block as RichTextBlock);
      if (richTextCount === undefined) return 0;
      count += richTextCount;
    } else if (block.type === "section") {
      const section = block as Extract<Block, { type: "section" }>;
      if (section.accessory || section.fields?.length || !addText(section.text)) return 0;
    } else if (block.type === "header") {
      if (!addText((block as Extract<Block, { type: "header" }>).text)) return 0;
    } else return 0;
  }

  return count > 0 && count < MAX_ENLARGED_EMOJI ? count : 0;
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
    threadContainsMessage(context.channelId, context.threadTs, context.messages, channelId, ts),
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
    prev.sourceUserId === message.sourceUserId &&
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
      (attachment) => !(attachment.isMessageUnfurl && attachment.ts === replyRef?.ts),
    ),
  };
}
