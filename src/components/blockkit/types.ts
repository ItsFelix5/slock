// Slack Block Kit types — trimmed to what a message-rendering client needs.
// Unknown/unsupported block or element types still type-check via the `type: string`
// fallback members below, so the renderer can show a graceful placeholder instead of crashing.

export interface TextObject {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

export interface ConfirmationDialog {
  title: TextObject;
  text: TextObject;
  confirm: TextObject;
  deny: TextObject;
  style?: "primary" | "danger";
}

export interface Option {
  text: TextObject;
  value?: string;
  description?: TextObject;
  url?: string;
}

export interface ButtonElement {
  type: "button";
  text: TextObject;
  action_id?: string;
  url?: string;
  value?: string;
  style?: "primary" | "danger";
  confirm?: ConfirmationDialog;
}

export interface ImageElement {
  type: "image";
  image_url?: string;
  slack_file?: { url?: string; id?: string };
  alt_text: string;
}

export interface OverflowElement {
  type: "overflow";
  action_id?: string;
  options: Option[];
  confirm?: ConfirmationDialog;
}

export interface SelectElement {
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
  placeholder?: TextObject;
  action_id?: string;
}

export interface DatePickerElement {
  type: "datepicker" | "timepicker" | "datetimepicker";
  action_id?: string;
  placeholder?: TextObject;
  initial_date?: string;
}

export interface CheckboxRadioElement {
  type: "checkboxes" | "radio_buttons";
  action_id?: string;
  options: Option[];
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
  type: "section";
  block_id?: string;
  text?: TextObject;
  fields?: TextObject[];
  accessory?: BlockElement;
}

export interface DividerBlock {
  type: "divider";
  block_id?: string;
}

export interface HeaderBlock {
  type: "header";
  block_id?: string;
  text: TextObject;
}

export interface ContextBlock {
  type: "context";
  block_id?: string;
  elements: (TextObject | ImageElement)[];
}

export interface ImageBlock {
  type: "image";
  block_id?: string;
  image_url: string;
  alt_text: string;
  title?: TextObject;
}

export interface ActionsBlock {
  type: "actions";
  block_id?: string;
  elements: BlockElement[];
}

export interface InputBlock {
  type: "input";
  block_id?: string;
  label: TextObject;
  element: BlockElement;
  hint?: TextObject;
  optional?: boolean;
}

// --- rich_text ---

export interface RichTextStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  highlight?: boolean;
  client_highlight?: boolean;
  unlink?: boolean;
}

export interface RichTextTextElement {
  type: "text";
  text: string;
  style?: RichTextStyle;
}

export interface RichTextLinkElement {
  type: "link";
  url: string;
  text?: string;
  unsafe?: boolean;
  style?: RichTextStyle;
}

export interface RichTextEmojiElement {
  type: "emoji";
  name: string;
  unicode?: string;
}

export interface RichTextUserElement {
  type: "user";
  user_id: string;
  style?: RichTextStyle;
}

export interface RichTextChannelElement {
  type: "channel";
  channel_id: string;
  style?: RichTextStyle;
}

export interface RichTextUsergroupElement {
  type: "usergroup";
  usergroup_id: string;
}

export interface RichTextBroadcastElement {
  type: "broadcast";
  range: "here" | "channel" | "everyone";
}

export interface RichTextColorElement {
  type: "color";
  value: string;
}

export interface RichTextDateElement {
  type: "date";
  timestamp: number;
  format: string;
  url?: string;
  fallback?: string;
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
  type: "rich_text_section";
  elements: RichTextInlineElement[];
}

export interface RichTextList {
  type: "rich_text_list";
  style: "bullet" | "ordered";
  elements: RichTextSection[];
  indent?: number;
  offset?: number;
  border?: number;
}

export interface RichTextPreformatted {
  type: "rich_text_preformatted";
  elements: RichTextInlineElement[];
  border?: number;
}

export interface RichTextQuote {
  type: "rich_text_quote";
  elements: RichTextInlineElement[];
  border?: number;
}

export type RichTextSubBlock =
  | RichTextSection
  | RichTextList
  | RichTextPreformatted
  | RichTextQuote;

export interface RichTextBlock {
  type: "rich_text";
  block_id?: string;
  elements: RichTextSubBlock[];
}

export interface UnknownBlock {
  type: string;
  block_id?: string;
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
