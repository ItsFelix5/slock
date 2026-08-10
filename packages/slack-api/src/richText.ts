// biome-ignore-all lint/style/useNamingConvention: Block Kit types intentionally mirror Slack's wire schema.
// rich_text block element types — split out of blocks.ts, which was hitting
// the per-file line cap.

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

// What a pasted Slack permalink becomes once it round-trips through blocks.
// channel_id/message_ts identify the quoted message directly — prefer those
// over parsing `url`/`text`, which are just display fallbacks.
export interface RichTextMessageMentionElement {
  channel_id?: string;
  message_ts?: string;
  text?: string;
  thread_ts?: string;
  type: "message_mention";
  url: string;
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
  | RichTextMessageMentionElement;

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
  // Slack can nest any sub-block here (e.g. a rich_text_list, for a bulleted
  // list created while the caret is inside a blockquote), not just inline
  // content — same union as a rich_text block's own top-level elements.
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
