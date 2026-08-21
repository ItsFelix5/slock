export interface RichTextStyle {
  bold?: boolean;
  client_highlight?: boolean;
  code?: boolean;
  highlight?: boolean;
  italic?: boolean;
  strike?: boolean;
  unlink?: boolean;
}

export interface RichTextTextElement {
  style?: RichTextStyle;
  text: string;
  type: "text";
}

export interface RichTextLinkElement {
  style?: RichTextStyle;
  text?: string;
  type: "link";
  unsafe?: boolean;
  url: string;
}

export interface RichTextEmojiElement {
  name: string;
  type: "emoji";
  unicode?: string;
}

export interface RichTextUserElement {
  style?: RichTextStyle;
  type: "user";
  user_id: string;
}

export interface RichTextChannelElement {
  channel_id: string;
  style?: RichTextStyle;
  type: "channel";
}

export interface RichTextUsergroupElement {
  type: "usergroup";
  usergroup_id: string;
}

export interface RichTextBroadcastElement {
  range: "here" | "channel" | "everyone";
  type: "broadcast";
}

export type BroadcastRange = RichTextBroadcastElement["range"];

export function isRichTextBroadcast(value: unknown): value is RichTextBroadcastElement {
  if (!(value && typeof value === "object")) return false;
  const element = value as { range?: unknown; type?: unknown };
  return (
    element.type === "broadcast" &&
    (element.range === "here" || element.range === "channel" || element.range === "everyone")
  );
}

export interface RichTextColorElement {
  type: "color";
  value: string;
}

export interface RichTextDateElement {
  fallback?: string;
  format: string;
  timestamp: number;
  type: "date";
  url?: string;
}

export interface RichTextMessageMentionElement {
  channel_id?: string;
  message_ts?: string;
  text?: string;
  thread_ts?: string;
  type: "message_mention";
  url: string;
}

export interface RichTextCanvasElement {
  file_id: string;
  text?: string;
  type: "canvas";
  url?: string;
}

export type RichTextInlineElement =
  | RichTextTextElement
  | RichTextLinkElement
  | RichTextEmojiElement
  | RichTextUserElement
  | RichTextChannelElement
  | RichTextUsergroupElement
  | RichTextBroadcastElement
  | RichTextColorElement
  | RichTextDateElement
  | RichTextMessageMentionElement
  | RichTextCanvasElement;

export interface RichTextSection {
  elements: RichTextInlineElement[];
  type: "rich_text_section";
}

export interface RichTextList {
  border?: number;
  elements: RichTextSection[];
  indent?: number;
  offset?: number;
  style: "bullet" | "ordered";
  type: "rich_text_list";
}

export interface RichTextPreformatted {
  border?: number;
  elements: RichTextInlineElement[];
  type: "rich_text_preformatted";
}

export interface RichTextQuote {
  border?: number;

  elements: (RichTextInlineElement | RichTextSubBlock)[];
  type: "rich_text_quote";
}

export type RichTextSubBlock =
  | RichTextSection
  | RichTextList
  | RichTextPreformatted
  | RichTextQuote;

export interface RichTextBlock {
  block_id?: string;
  elements: RichTextSubBlock[];
  type: "rich_text";
}

function broadcastRangeFromElements(elements: readonly unknown[]): BroadcastRange | undefined {
  for (const element of elements) {
    if (isRichTextBroadcast(element)) return element.range;
    if (
      element &&
      typeof element === "object" &&
      "elements" in element &&
      Array.isArray(element.elements)
    ) {
      const range = broadcastRangeFromElements(element.elements);
      if (range) return range;
    }
  }
}

export function broadcastRangeFromRichTextBlocks(
  blocks: readonly RichTextBlock[],
): BroadcastRange | undefined {
  for (const block of blocks) {
    const range = broadcastRangeFromElements(block.elements);
    if (range) return range;
  }
}

function richTextInlineToPlainText(el: RichTextInlineElement): string {
  switch (el.type) {
    case "text":
      return el.text;
    case "link":
      return el.text || el.url;
    case "emoji":
      return `:${el.name}:`;
    case "user":
      return `<@${el.user_id}>`;
    case "channel":
      return `<#${el.channel_id}>`;
    case "usergroup":
      return `<!subteam^${el.usergroup_id}>`;
    case "broadcast":
      return `<!${el.range}>`;
    case "message_mention":
      return el.text ?? "";
    case "date":
      return el.fallback ?? "";
    case "canvas":
      return el.text ?? "";
    default:
      return "";
  }
}

function richTextSubBlockToPlainText(sub: RichTextSubBlock): string {
  switch (sub.type) {
    case "rich_text_section":
    case "rich_text_preformatted":
      return sub.elements.map(richTextInlineToPlainText).join("");
    case "rich_text_list":
      return sub.elements
        .map((item) => item.elements.map(richTextInlineToPlainText).join(""))
        .join(" ");
    case "rich_text_quote":
      return sub.elements
        .map((el) =>
          "elements" in el ? richTextSubBlockToPlainText(el) : richTextInlineToPlainText(el),
        )
        .join("");
    default:
      return "";
  }
}

export function richTextBlocksToPlainText(blocks: readonly RichTextBlock[]): string {
  return blocks
    .map((block) => block.elements.map(richTextSubBlockToPlainText).join("\n"))
    .join("\n")
    .trim();
}
