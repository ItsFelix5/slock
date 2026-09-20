import { type Block, type Message, narrowByType, type RichTextBlock } from "./api";

const BRACKETED_LINK_RE = /^<(https?:\/\/[^\s|>]+)(?:\|([^>]*))?>/;
const BARE_PERMALINK_RE = /^(https?:\/\/[^\s<>]+)/;
const PERMALINK_RE = /\/archives\/([A-Z0-9]+)\/p(\d+)/;

function permalinkToChannelTs(url: string): { channelId: string; ts: string } | null {
  const match = PERMALINK_RE.exec(url);
  if (!match) return null;
  const [, channelId, digits] = match;
  return { channelId, ts: `${digits.slice(0, -6)}.${digits.slice(-6)}` };
}

function isBareLabel(label: string | undefined): boolean {
  return label === undefined || label === "" || label === "." || label === "​";
}

export function encodeReplyLink(permalink: string): string {
  return `<${permalink}|​>`;
}

export function threadContainsMessage(
  channelId: string,
  threadTs: string | undefined,
  messages: readonly Pick<Message, "ts">[],
  targetChannelId: string,
  targetTs: string,
): boolean {
  return (
    !!threadTs &&
    channelId === targetChannelId &&
    (targetTs === threadTs || messages.some((message) => message.ts === targetTs))
  );
}

export function parseReplyLink(
  text: string,
  isThreadMessage?: (channelId: string, ts: string) => boolean,
): {
  ts: string;
  channelId: string;
  rest: string;
  prefix: string;
  url: string;
} | null {
  const bracketed = BRACKETED_LINK_RE.exec(text);
  if (bracketed) {
    const parsed = permalinkToChannelTs(bracketed[1]);
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
      prefix: bracketed[0],
      rest: bare ? remainder.trim() : `${label}${remainder}`,
      ts,
      url: bracketed[1],
    };
  }

  const bareLink = BARE_PERMALINK_RE.exec(text);
  if (!bareLink) return null;
  const parsed = permalinkToChannelTs(bareLink[1]);
  if (!parsed) return null;
  const rest = text.slice(bareLink[0].length);
  if (!rest.trim()) return null;
  if (isThreadMessage && !isThreadMessage(parsed.channelId, parsed.ts)) return null;
  return {
    ...parsed,
    prefix: bareLink[0],
    rest: rest.trim(),
    url: bareLink[1],
  };
}

export function parseReplyLinkFromBlocks(
  blocks: readonly Block[],
): { ts: string; channelId: string; url: string; blocks: Block[] } | null {
  const richText = narrowByType<Block, RichTextBlock>(blocks[0], "rich_text");
  if (!richText) return null;
  const [section] = richText.elements;
  if (section?.type !== "rich_text_section") return null;
  const [mention] = section.elements;
  if (mention?.type !== "message_mention") return null;

  const parsed =
    mention.channel_id && mention.message_ts
      ? { channelId: mention.channel_id, ts: mention.message_ts }
      : mention.url
        ? permalinkToChannelTs(mention.url)
        : null;
  if (!parsed) return null;

  const restSectionElements = section.elements.slice(1);
  const [firstRest] = restSectionElements;
  if (firstRest?.type === "text") {
    restSectionElements[0] = {
      ...firstRest,
      text: firstRest.text.trim(),
    };
  }
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
    url: mention.url,
  };
}
