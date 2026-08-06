import type {
  Attachment,
  Block,
  Message,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
  TextObject,
} from "@slock/slack-api";
import { parseReplyLink } from "../../../lib/replyLink";
import { isUnreadDividerBoundary } from "../../../lib/store";

const USER_PROFILE_ID_RE = /^[UW]/;

// A user token posting via bot_profile still has userId set to the real
// poster; Slackbot posts have neither a real userId matching this pattern
// nor a bot user id worth opening a profile for, so it gets a fixed synthetic
// one. Anything else that doesn't match is a plain app/bot post with no
// profile to open.
export function resolveProfileUserId(msg: Pick<Message, "userId" | "botName">): string | undefined {
  const id = USER_PROFILE_ID_RE.test(msg.userId)
    ? msg.userId
    : msg.botName === "Slackbot"
      ? "USLACKBOT"
      : msg.userId;
  return USER_PROFILE_ID_RE.test(id) ? id : undefined;
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
    return addElements(subBlock.elements);
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
  // The reply immediately after the root gets its date folded into the
  // "N replies" divider below instead of getting its own day-divider right
  // underneath it — otherwise a thread whose root is from a previous day
  // but whose only reply came in today shows two divider bars back-to-back.
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
  const isInThread = (channelId: string, ts: string) =>
    !!context.threadTs &&
    channelId === context.channelId &&
    (ts === context.threadTs || context.messages.some((candidate) => candidate.ts === ts));
  const replyRef = parseReplyLink(message.text, isInThread);
  const messageText = replyRef?.rest ?? message.text;
  const showThreadContext = context.hasOpenThread && !!message.isBroadcast && !!message.threadTs;
  // The complementary case: viewed from inside the thread panel itself
  // (where showThreadContext never fires, since there's no "open thread"
  // callback to jump to), a broadcast reply gets a small badge instead so
  // it's still clear this reply also went out to the channel.
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
