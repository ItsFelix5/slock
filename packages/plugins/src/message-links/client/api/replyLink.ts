import { defined, narrowByType } from "@slock/core";
import { isChannelId, isTs, messageMentionUrl } from "@slock/slack";
import { getCachedWorkspaceDomain } from "@slock/slack/client";
import type {
  Block,
  ChannelId,
  Message,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
  Ts,
} from "@slock/types";
import { parseSlackPermalink } from "./slackPermalink";

const BRACKETED_LINK_RE = /^<(https?:\/\/[^\s|>]+)(?:\|([^>]*))?>/;
const BARE_PERMALINK_RE = /^(https?:\/\/[^\s<>]+)/;

type MessageRef = { channelId: ChannelId; ts: Ts };

function permalinkToChannelTs(url: string): MessageRef | null {
  const target = parseSlackPermalink(url);
  return target && { channelId: target.channelId, ts: target.messageTs };
}

function messageRef(channelId: string, ts: string): MessageRef | null {
  return isChannelId(channelId) && isTs(ts) ? { channelId, ts } : null;
}

export const INVISIBLE_LABEL = "︇︇";

function isBareLabel(label: string | undefined): boolean {
  return label === undefined || label === "" || label === "." || label === INVISIBLE_LABEL;
}

export function encodeReplyLink(permalink: string): string {
  return `<${permalink}|${INVISIBLE_LABEL}>`;
}

export function threadContainsMessage(
  channelId: ChannelId,
  threadTs: Ts | undefined,
  messages: readonly Pick<Message, "ts">[],
  targetChannelId: ChannelId,
  targetTs: Ts,
): boolean {
  return (
    !!threadTs &&
    channelId === targetChannelId &&
    (targetTs === threadTs || messages.some((message) => message.ts === targetTs))
  );
}

function parseReplyLink(
  text: string,
  isThreadMessage?: (channelId: ChannelId, ts: Ts) => boolean,
): {
  ts: Ts;
  channelId: ChannelId;
  rest: string;
  url: string;
} | null {
  const bracketed = BRACKETED_LINK_RE.exec(text);
  if (bracketed) {
    const parsed = permalinkToChannelTs(defined(bracketed[1]));
    if (!parsed) return null;
    const { channelId, ts } = parsed;
    const [, , label] = bracketed;

    const bare = isBareLabel(label) || label === bracketed[1];
    const remainder = text.slice(bracketed[0].length);
    if (!remainder.trim()) return null;
    const allowed = isThreadMessage ? isThreadMessage(channelId, ts) : bare;
    if (!allowed) return null;
    return {
      channelId,
      rest: bare ? remainder.trim() : `${label}${remainder}`,
      ts,
      url: defined(bracketed[1]),
    };
  }

  const bareLink = BARE_PERMALINK_RE.exec(text);
  if (!bareLink) return null;
  const parsed = permalinkToChannelTs(defined(bareLink[1]));
  if (!parsed) return null;
  const rest = text.slice(bareLink[0].length);
  if (!rest.trim()) return null;
  if (isThreadMessage && !isThreadMessage(parsed.channelId, parsed.ts)) return null;
  return {
    ...parsed,
    rest: rest.trim(),
    url: defined(bareLink[1]),
  };
}

function replyTargetFromElement(element: RichTextInlineElement): ReplyTarget | null {
  if (element.type === "message_mention") {
    const parsed = messageRef(element.channel_id, element.message_ts);
    return parsed && { ...parsed, url: messageMentionUrl(element, getCachedWorkspaceDomain()) };
  }
  if (element.type === "link" && (isBareLabel(element.text) || element.text === element.url)) {
    const parsed = permalinkToChannelTs(element.url);
    return parsed && { ...parsed, url: element.url };
  }
  return null;
}

export function withReplyLink(blocks: Block[], permalink: string): Block[] {
  const link: RichTextInlineElement = { text: INVISIBLE_LABEL, type: "link", url: permalink };
  const richText = narrowByType<Block, RichTextBlock>(blocks[0], "rich_text");
  if (!richText) return blocks;
  const [sub, ...restSubs] = richText.elements;
  const elements: RichTextSubBlock[] =
    sub?.type === "rich_text_section"
      ? [{ ...sub, elements: [link, { text: " ", type: "text" }, ...sub.elements] }, ...restSubs]
      : [{ elements: [link], type: "rich_text_section" }, ...richText.elements];
  return [{ ...richText, elements }, ...blocks.slice(1)];
}

function parseReplyLinkFromBlocks(
  blocks: readonly Block[],
  isThreadMessage?: (channelId: ChannelId, ts: Ts) => boolean,
): (ReplyTarget & { blocks: Block[] }) | null {
  const richText = narrowByType<Block, RichTextBlock>(blocks[0], "rich_text");
  if (!richText) return null;
  const [section] = richText.elements;
  if (section?.type !== "rich_text_section") return null;
  const [leading] = section.elements;
  const parsed = leading ? replyTargetFromElement(leading) : null;
  if (!parsed) return null;
  if (isThreadMessage && !isThreadMessage(parsed.channelId, parsed.ts)) return null;

  const [firstRest, ...afterFirst] = section.elements.slice(1);
  const trimmedFirst =
    firstRest?.type === "text" ? { ...firstRest, text: firstRest.text.trim() } : firstRest;
  const restSectionElements =
    trimmedFirst && !(trimmedFirst.type === "text" && !trimmedFirst.text)
      ? [trimmedFirst, ...afterFirst]
      : afterFirst;
  const restRichTextElements = richText.elements.slice(1);
  const strippedRichText: RichTextBlock[] =
    restSectionElements.length > 0
      ? [
          {
            ...richText,
            elements: [{ ...section, elements: restSectionElements }, ...restRichTextElements],
          },
        ]
      : restRichTextElements.length > 0
        ? [{ ...richText, elements: restRichTextElements }]
        : [];

  return {
    ...parsed,
    blocks: [...strippedRichText, ...blocks.slice(1)],
  };
}

export interface ReplyTarget {
  channelId: ChannelId;
  ts: Ts;
  url: string;
}

export function splitReplyLink(
  message: { blocks?: readonly Block[]; text: string },
  isThreadMessage?: (channelId: ChannelId, ts: Ts) => boolean,
): { blocks: Block[] | undefined; replyRef: ReplyTarget | null; text: string } {
  const textRef = parseReplyLink(message.text, isThreadMessage);
  const text = textRef?.rest ?? message.text;
  if (!message.blocks?.length)
    return { blocks: undefined, replyRef: textRef && target(textRef), text };
  const blockRef = parseReplyLinkFromBlocks(message.blocks, isThreadMessage);
  const blocks = blockRef ? blockRef.blocks : [...message.blocks];
  return {
    blocks: blocks.length ? blocks : undefined,
    replyRef: blockRef && target(blockRef),
    text,
  };
}

function target({ channelId, ts, url }: ReplyTarget): ReplyTarget {
  return { channelId, ts, url };
}
