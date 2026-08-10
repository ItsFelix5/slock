import type { Block, Message, RichTextBlock } from "@slock/slack-api";

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
): { ts: string; channelId: string; rest: string; prefix: string; url: string } | null {
  const bracketed = BRACKETED_LINK_RE.exec(text);
  if (bracketed) {
    const parsed = permalinkToChannelTs(bracketed[1]);
    if (!parsed) return null;
    const { channelId, ts } = parsed;
    const [, , label] = bracketed;
    const bare = isBareLabel(label);
    const remainder = text.slice(bracketed[0].length);
    const linkedThreadMessage = isThreadMessage?.(channelId, ts) ?? false;
    if (!remainder.trim()) return null;
    if (!(bare || linkedThreadMessage)) return null;
    return {
      channelId,
      prefix: bracketed[0],
      rest: bare ? remainder : `${label}${remainder}`,
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
  return {
    ...parsed,
    prefix: bareLink[0],
    rest,
    url: bareLink[1],
  };
}

export function parseReplyLinkFromBlocks(
  blocks: readonly Block[],
): { ts: string; channelId: string; url: string; blocks: Block[] } | null {
  const [rawRichText] = blocks;
  if (rawRichText?.type !== "rich_text") return null;
  const richText = rawRichText as RichTextBlock;
  const [section] = richText.elements;
  if (section?.type !== "rich_text_section") return null;
  const [mention] = section.elements;
  if (mention?.type !== "message_mention" || !mention.url) return null;
  const parsed = permalinkToChannelTs(mention.url);
  if (!parsed) return null;

  const restSectionElements = section.elements.slice(1);
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

  return { ...parsed, blocks: [...strippedRichText, ...blocks.slice(1)], url: mention.url };
}
