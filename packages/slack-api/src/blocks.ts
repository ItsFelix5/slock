// biome-ignore-all lint/style/useNamingConvention: Block Kit types intentionally mirror Slack's wire schema.
// Slack Block Kit types — trimmed to what a message-rendering client needs.
// Unknown/unsupported block or element types still type-check via the `type: string`
// fallback members below, so the renderer can show a graceful placeholder instead of crashing.

export interface TextObject {
  emoji?: boolean;
  text: string;
  type: "plain_text" | "mrkdwn";
  verbatim?: boolean;
}

export interface ConfirmationDialog {
  confirm: TextObject;
  deny: TextObject;
  style?: "primary" | "danger";
  text: TextObject;
  title: TextObject;
}

export interface Option {
  description?: TextObject;
  text: TextObject;
  url?: string;
  value?: string;
}

export interface ButtonElement {
  action_id?: string;
  confirm?: ConfirmationDialog;
  style?: "primary" | "danger";
  text: TextObject;
  type: "button";
  url?: string;
  value?: string;
}

export interface ImageElement {
  alt_text: string;
  image_url?: string;
  slack_file?: { url?: string; id?: string };
  type: "image";
}

export interface OverflowElement {
  action_id?: string;
  confirm?: ConfirmationDialog;
  options: Option[];
  type: "overflow";
}

export interface SelectElement {
  action_id?: string;
  placeholder?: TextObject;
  type:
    | "static_select"
    | "external_select"
    | "users_select"
    | "conversations_select"
    | "channels_select"
    | "multi_static_select"
    | "multi_external_select"
    | "multi_users_select"
    | "multi_conversations_select"
    | "multi_channels_select";
}

export interface DatePickerElement {
  action_id?: string;
  initial_date?: string;
  placeholder?: TextObject;
  type: "datepicker" | "timepicker" | "datetimepicker";
}

export interface CheckboxRadioElement {
  action_id?: string;
  options: Option[];
  type: "checkboxes" | "radio_buttons";
}

export interface UnknownElement {
  type: string;
  [key: string]: unknown;
}

export type BlockElement =
  | ButtonElement
  | ImageElement
  | OverflowElement
  | SelectElement
  | DatePickerElement
  | CheckboxRadioElement
  | UnknownElement;

export interface SectionBlock {
  accessory?: BlockElement;
  block_id?: string;
  fields?: TextObject[];
  text?: TextObject;
  type: "section";
}

export interface DividerBlock {
  block_id?: string;
  type: "divider";
}

export interface HeaderBlock {
  block_id?: string;
  text: TextObject;
  type: "header";
}

export interface ContextBlock {
  block_id?: string;
  elements: (TextObject | ImageElement)[];
  type: "context";
}

export interface ImageBlock {
  alt_text: string;
  block_id?: string;
  image_url: string;
  title?: TextObject;
  type: "image";
}

export interface ActionsBlock {
  block_id?: string;
  elements: BlockElement[];
  type: "actions";
}

export interface InputBlock {
  block_id?: string;
  element: BlockElement;
  hint?: TextObject;
  label: TextObject;
  optional?: boolean;
  type: "input";
}

// --- rich_text ---

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

export type RichTextInlineElement =
  | RichTextTextElement
  | RichTextLinkElement
  | RichTextEmojiElement
  | RichTextUserElement
  | RichTextChannelElement
  | RichTextUsergroupElement
  | RichTextBroadcastElement
  | RichTextColorElement
  | RichTextDateElement;

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
  elements: RichTextInlineElement[];
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

export interface UnknownBlock {
  block_id?: string;
  type: string;
  [key: string]: unknown;
}

export type Block =
  | SectionBlock
  | DividerBlock
  | HeaderBlock
  | ContextBlock
  | ImageBlock
  | ActionsBlock
  | InputBlock
  | RichTextBlock
  | UnknownBlock;
