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

export interface OptionGroup {
  label: TextObject;
  options: Option[];
}

interface ActionElement {
  action_id?: string;
  confirm?: ConfirmationDialog;
}

export interface ButtonElement extends ActionElement {
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

export interface SelectElement extends ActionElement {
  initial_option?: Option;
  initial_options?: Option[];
  option_groups?: OptionGroup[];
  options?: Option[];
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

export interface DatePickerElement extends ActionElement {
  initial_date?: string;
  initial_time?: string;
  initial_datetime?: number;
  placeholder?: TextObject;
  type: "datepicker" | "timepicker" | "datetimepicker";
}

export interface CheckboxRadioElement extends ActionElement {
  initial_option?: Option;
  initial_options?: Option[];
  options: Option[];
  type: "checkboxes" | "radio_buttons";
}

export interface TextInputElement extends ActionElement {
  initial_value?: string;
  max_length?: number;
  min_length?: number;
  multiline?: boolean;
  placeholder?: TextObject;
  type: "plain_text_input" | "email_text_input" | "url_text_input" | "number_input";
}

export interface RichTextInputElement extends ActionElement {
  initial_value?: RichTextBlock;
  placeholder?: TextObject;
  type: "rich_text_input";
}

export interface FileInputElement extends ActionElement {
  filetypes?: string[];
  max_files?: number;
  type: "file_input";
}

export interface WorkflowButtonElement extends ActionElement {
  style?: "primary" | "danger";
  text: TextObject;
  type: "workflow_button";
  workflow?: { trigger?: { url?: string } };
}

export interface IconButtonElement extends ActionElement {
  accessibility_label?: string;
  icon: string;
  text: TextObject;
  type: "icon_button";
}

export interface FeedbackButtonsElement extends ActionElement {
  negative_button: { text: TextObject; value?: string };
  positive_button: { text: TextObject; value?: string };
  type: "feedback_buttons";
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
  | TextInputElement
  | RichTextInputElement
  | FileInputElement
  | WorkflowButtonElement
  | IconButtonElement
  | FeedbackButtonsElement
  | UnknownElement;

export interface SectionBlock {
  accessory?: BlockElement;
  block_id?: string;
  expand?: boolean;
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
  image_height?: number;
  is_animated?: boolean;
  image_width?: number;
  image_url?: string;
  slack_file?: { url?: string; id?: string };
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

export interface MarkdownBlock {
  block_id?: string;
  text: string;
  type: "markdown";
}

export interface FileBlock {
  block_id?: string;
  external_id: string;
  source: "remote" | string;
  type: "file";
}

export interface VideoBlock {
  alt_text: string;
  author_name?: string;
  block_id?: string;
  description?: TextObject;
  provider_icon_url?: string;
  provider_name?: string;
  thumbnail_url: string;
  title: TextObject;
  title_url?: string;
  type: "video";
  video_url: string;
}

export interface SlackIconObject {
  name: string;
  type: "icon";
}

export interface CardBlock {
  actions?: BlockElement[];
  block_id?: string;
  body?: TextObject;
  hero_image?: ImageElement;
  icon?: ImageElement;
  slack_icon?: SlackIconObject;
  subtitle?: TextObject;
  subtext?: TextObject;
  title?: TextObject;
  type: "card";
}

export interface CarouselBlock {
  block_id?: string;
  elements: CardBlock[];
  type: "carousel";
}

export interface ContainerBlock {
  block_id?: string;
  /** @deprecated undocumented alias observed in the wild; child_blocks is the documented field */
  blocks?: Block[];
  child_blocks?: Block[];
  default_collapsed?: boolean;
  /** @deprecated undocumented alias observed in the wild; child_blocks is the documented field */
  elements?: Block[];
  has_header_divider?: boolean;
  icon?: ImageElement;
  is_collapsible?: boolean;
  rich_text_title?: RichTextBlock;
  subtitle?: TextObject;
  title?: TextObject;
  type: "container";
  width?: "narrow" | "standard" | "wide" | "full";
}

export interface ContextActionsBlock {
  block_id?: string;
  elements: BlockElement[];
  type: "context_actions";
}

export interface TableCell {
  elements?: RichTextBlock["elements"];
  text?: string;
  type: "raw_text" | "raw_number" | "rich_text";
  value?: number;
}

export interface TableBlock {
  block_id?: string;
  column_settings?: ({
    align?: "left" | "center" | "right";
    is_wrapped?: boolean;
  } | null)[];
  rows: TableCell[][];
  type: "table" | "data_table";
  caption?: string;
  page_size?: number;
  row_header_column_index?: number;
}

export interface ChartSegment {
  label: string;
  value: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSeries {
  data: ChartDataPoint[];
  name: string;
}

export interface ChartAxisConfig {
  categories: string[];
  x_label?: string;
  y_label?: string;
}

export type Chart =
  | { segments: ChartSegment[]; type: "pie" }
  | { axis_config: ChartAxisConfig; series: ChartSeries[]; type: "bar" | "area" | "line" };

export interface DataVisualizationBlock {
  block_id?: string;
  chart: Chart;
  title: string;
  type: "data_visualization";
}

export interface TaskCardBlock {
  block_id?: string;
  details?: RichTextBlock;
  output?: RichTextBlock;
  sources?: { text: string; type: "url"; url: string }[];
  status?: "pending" | "in_progress" | "complete" | "error";
  task_id: string;
  title: string;
  type: "task_card";
}

export interface PlanBlock {
  block_id?: string;
  tasks?: TaskCardBlock[];
  title: TextObject | string;
  type: "plan";
}

export interface AlertBlock {
  block_id?: string;
  level?: "default" | "info" | "warning" | "error" | "success";
  text?: TextObject;
  title?: TextObject;
  type: "alert";
  [key: string]: unknown;
}

export type {
  RichTextBlock,
  RichTextBroadcastElement,
  RichTextChannelElement,
  RichTextColorElement,
  RichTextDateElement,
  RichTextEmojiElement,
  RichTextInlineElement,
  RichTextLinkElement,
  RichTextList,
  RichTextMessageMentionElement,
  RichTextPreformatted,
  RichTextQuote,
  RichTextSection,
  RichTextStyle,
  RichTextSubBlock,
  RichTextTextElement,
  RichTextUserElement,
  RichTextUsergroupElement,
} from "./richText";

import { broadcastRangeFromRichTextBlocks, type RichTextBlock } from "./richText";

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
  | MarkdownBlock
  | FileBlock
  | VideoBlock
  | CardBlock
  | CarouselBlock
  | ContainerBlock
  | ContextActionsBlock
  | TableBlock
  | DataVisualizationBlock
  | TaskCardBlock
  | PlanBlock
  | AlertBlock
  | RichTextBlock
  | UnknownBlock;

export function broadcastRangeFromBlocks(blocks: readonly Block[] | undefined) {
  return broadcastRangeFromRichTextBlocks(
    (blocks ?? []).filter((block): block is RichTextBlock => block.type === "rich_text"),
  );
}

export interface ModalView {
  app_id?: string;
  blocks: Block[];
  callback_id?: string;
  clear_on_close?: boolean;
  close?: TextObject | null;
  external_id?: string;
  hash?: string;
  id: string;
  notify_on_close?: boolean;
  previous_view_id?: string | null;
  private_metadata?: string;
  root_view_id?: string;
  submit?: TextObject | null;
  team_id?: string;
  title: TextObject;
  type: "modal" | "home" | string;
}
