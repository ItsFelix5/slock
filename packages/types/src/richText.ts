export interface RichTextStyle {
  bold?: boolean;
  client_highlight?: boolean;
  code?: boolean;
  highlight?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  unlink?: boolean;
}

interface RichTextTextElement {
  style?: RichTextStyle;
  text: string;
  type: "text";
}

interface RichTextLinkElement {
  style?: RichTextStyle;
  text?: string;
  type: "link";
  unsafe?: boolean;
  url: string;
}

interface RichTextEmojiElement {
  name: string;
  type: "emoji";
  unicode?: string;
}

interface RichTextUserElement {
  style?: RichTextStyle;
  type: "user";
  user_id: string;
}

interface RichTextChannelElement {
  channel_id: string;
  style?: RichTextStyle;
  type: "channel";
}

interface RichTextUsergroupElement {
  type: "usergroup";
  usergroup_id: string;
}

export interface RichTextBroadcastElement {
  range: "here" | "channel" | "everyone";
  type: "broadcast";
}

export type BroadcastRange = RichTextBroadcastElement["range"];

interface RichTextColorElement {
  type: "color";
  value: string;
}

type RichTextTagColor =
  | "gray"
  | "brown"
  | "purple"
  | "indigo"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red";

export interface RichTextTagElement {
  color?: RichTextTagColor;
  style?: RichTextStyle;
  text: string;
  type: "tag";
}

interface RichTextDateElement {
  fallback?: string;
  format: string;
  timestamp: number;
  type: "date";
  url?: string;
}

export interface RichTextMessageMentionElement {
  author_id?: string;
  channel_id: string;
  message_ts: string;
  style?: RichTextStyle;
  text?: string;
  thread_ts?: string;
  type: "message_mention";
  url?: string;
}

interface RichTextCanvasElement {
  file_id: string;
  text?: string;
  type: "canvas";
  url?: string;
}

interface RichTextCanvasUserMentionElement {
  style?: RichTextStyle;
  thread_id?: string;
  type: "canvas_user_mention";
  user_id: string;
}

interface RichTextCanvasMessageUnfurlElement {
  root_message_channel: string;
  root_message_ts: string;
  style?: RichTextStyle;
  type: "canvas_message_unfurl";
}

interface RichTextAttachmentMentionElement {
  style?: RichTextStyle;
  text?: string;
  type: "attachment_mention";
  url: string;
}

interface RichTextCitationElement {
  index: number;
  text: string;
  type: "citation";
  url: string;
}

interface RichTextFileElement {
  file_id: string;
  style?: RichTextStyle;
  text?: string;
  type: "file";
  url?: string;
}

interface RichTextListRecordElement {
  file_id: string;
  record_id?: string;
  style?: RichTextStyle;
  text?: string;
  type: "list_record";
  url?: string;
  view_id?: string;
}

interface RichTextSalesforceDataFieldElement {
  salesforce_field_api_name?: string;
  salesforce_field_label?: string;
  salesforce_include_field_label?: boolean;
  salesforce_record_id: string;
  style?: RichTextStyle;
  type: "salesforce_data_field";
}

interface RichTextTeamElement {
  style?: RichTextStyle;
  team_id: string;
  type: "team";
}

interface RichTextWorkObjectMentionElement {
  app_id: string;
  entity_id: string;
  style?: RichTextStyle;
  text: string;
  type: "work_object_mention";
  url: string;
}

interface RichTextWorkflowMentionElement {
  channel_id?: string;
  function_trigger_id: string;
  style?: RichTextStyle;
  text: string;
  ts?: string;
  type: "workflow_mention";
  url?: string;
  workflow_id: string;
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
  | RichTextTagElement
  | RichTextDateElement
  | RichTextMessageMentionElement
  | RichTextCanvasElement
  | RichTextCanvasUserMentionElement
  | RichTextCanvasMessageUnfurlElement
  | RichTextAttachmentMentionElement
  | RichTextCitationElement
  | RichTextFileElement
  | RichTextListRecordElement
  | RichTextSalesforceDataFieldElement
  | RichTextTeamElement
  | RichTextWorkObjectMentionElement
  | RichTextWorkflowMentionElement;

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

interface RichTextPreformatted {
  border?: number;
  elements: RichTextInlineElement[];
  type: "rich_text_preformatted";
}

interface RichTextQuote {
  border?: number;

  elements: (RichTextInlineElement | RichTextSubBlock)[];
  type: "rich_text_quote";
}

export interface RichTextHeader {
  elements: RichTextInlineElement[];
  level?: 1 | 2 | 3 | 4;
  type: "rich_text_header";
}

interface RichTextDivider {
  type: "rich_text_divider";
}

export type RichTextSubBlock =
  | RichTextDivider
  | RichTextHeader
  | RichTextSection
  | RichTextList
  | RichTextPreformatted
  | RichTextQuote;

export interface RichTextBlock {
  block_id?: string;
  elements: RichTextSubBlock[];
  type: "rich_text";
}
