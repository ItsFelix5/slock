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
  author_id?: string;
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
