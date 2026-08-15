export type {
  BlockElement,
  ButtonElement,
  CheckboxRadioElement,
  ConfirmationDialog,
  DatePickerElement,
  FeedbackButtonsElement,
  FileInputElement,
  IconButtonElement,
  ImageElement,
  Option,
  OptionGroup,
  OverflowElement,
  RichTextInputElement,
  SelectElement,
  TextInputElement,
  TextObject,
  UnknownElement,
  WorkflowButtonElement,
} from "./blockElements";

import type { DataVisualizationBlock, TableBlock } from "./blockDataViz";
import type { BlockElement, ImageElement, TextObject } from "./blockElements";

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

export type {
  Chart,
  ChartAxisConfig,
  ChartDataPoint,
  ChartSegment,
  ChartSeries,
  DataVisualizationBlock,
  TableBlock,
  TableCell,
} from "./blockDataViz";

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
