import type {
  Attachment,
  Block,
  Message,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
  TextObject,
} from "@slock/slack-api";
import {
  parseReplyLink,
  parseReplyLinkFromBlocks,
  threadContainsMessage,
} from "../../../lib/replyLink";
import { isUnreadDividerBoundary } from "../../../lib/store";

const USER_PROFILE_ID_RE = /^[UW]/;
const BOT_PROFILE_ID_RE = /^B/;

const RICH_TEXT_SUB_BLOCK_TYPES = new Set<RichTextSubBlock["type"]>([
  "rich_text_section",
  "rich_text_list",
  "rich_text_preformatted",
  "rich_text_quote",
]);

// A rich_text_quote's `elements` can mix plain inline content with a fully
// nested sub-block (most often a rich_text_list, from starting a bullet list
// while the caret sits inside a blockquote) — this tells the two apart, used
// here to decide whether a message is emoji-only.
export function isRichTextSubBlock(
  element: RichTextInlineElement | RichTextSubBlock,
): element is RichTextSubBlock {
  return RICH_TEXT_SUB_BLOCK_TYPES.has(element.type as RichTextSubBlock["type"]);
}

// A user token posting via bot_profile still has userId set to the real
// poster; Slackbot posts have neither a real userId matching this pattern
// nor a bot user id worth opening a profile for, so it gets a fixed synthetic
// one. A bot/webhook post (including one with a per-message custom username
// override) has userId set to its bot_id — fetchUser resolves those through
// bots.info, so the card can still open, just showing the bot's own identity
// rather than the overridden name.
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

// resolveProfileUserId also returns bot ids (for opening the bot's profile card),
// but the Hack Club identity/hackatime lookup behind fetchUserStatus only knows
// about real Slack users, so bot ids must be filtered out before calling it.
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

// True for a genuine account (including an app posting via a user token,
// where userId is the real poster and botId/botName just tag along on
// bot_profile). False for a plain bot/webhook post, where userId is only
// ever the bot_id repeated. Shared by messages and activity rows so both
// agree on when to trust the store-resolved user vs. the message's own
// botName/botIcon.
export function hasRealMessageAuthor(msg: MessageAuthorFields): boolean {
  return (
    ((msg.botId || msg.botName) && USER_PROFILE_ID_RE.test(msg.sourceUserId ?? "")) ||
    (!!msg.userId && msg.userId !== msg.botId)
  );
}

// botName/botIcon are per-message overrides (a webhook's custom username/
// icon, or bot_profile's defaults) already delivered with the message —
// preferred over a lazily store-resolved user, which for a plain bot post is
// only the bot's own registered identity via bots.info, not the override.
export function resolveAuthorDisplayName(
  msg: MessageAuthorFields,
  userName: string | undefined,
  fallback: string,
): string {
  return (hasRealMessageAuthor(msg) ? userName : undefined) ?? msg.botName ?? fallback;
}

export function unresolvedAuthorFallback(msg: Pick<MessageAuthorFields, "userId">): string {
  return msg.userId ? "Loading…" : "Someone";
}

export function resolveAuthorAvatarUrl(
  msg: MessageAuthorFields,
  userAvatarUrl: string | undefined,
): string | undefined {
  return hasRealMessageAuthor(msg) ? userAvatarUrl : msg.botIcon ?? userAvatarUrl;
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
    // A quote nesting a full sub-block (see isRichTextSubBlock) is never
    // just emoji — treat it the same as any other non-text/emoji element.
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
  const textReplyRef = parseReplyLink(message.text, (channelId, ts) =>
    threadContainsMessage(context.channelId, context.threadTs, context.messages, channelId, ts),
  );
  // A message built as blocks (a real Slack client's pasted-permalink quote,
  // as opposed to one of our own composer-authored reply links) can carry
  // the reply reference only in `blocks` — `text` is a wire-independent
  // fallback field that's often blank for these. Falling back to the blocks
  // scan is what lets that case still collapse into an (invisible) reply
  // reference instead of showing the raw permalink as a rendered link.
  const blockReplyRef =
    !textReplyRef && message.blocks?.length ? parseReplyLinkFromBlocks(message.blocks) : undefined;
  const replyRef =
    textReplyRef ??
    (blockReplyRef
      ? {
          channelId: blockReplyRef.channelId,
          prefix: "",
          // `rest` isn't used for rendering here — the remaining content (if
          // any) renders through `renderBlocks` below, not Mrkdwn — but it
          // still needs to be empty rather than `message.text`, since that's
          // exactly what Mrkdwn falls back to when `renderBlocks` comes back
          // empty (the mention was the message's only content).
          rest: "",
          ts: blockReplyRef.ts,
          url: blockReplyRef.url,
        }
      : null);
  const messageText = replyRef?.rest ?? message.text;
  // Mirrors the branches above: our own text-based reply links always fall
  // back to plain Mrkdwn (their `rest` already carries all the content), a
  // blocks-based one renders the same blocks minus the stripped-out leading
  // mention, and anything else renders its blocks untouched.
  const rawRenderBlocks = textReplyRef ? undefined : (blockReplyRef?.blocks ?? message.blocks);
  const renderBlocks = rawRenderBlocks?.length ? rawRenderBlocks : undefined;
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
