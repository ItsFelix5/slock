import type { RichTextBlock } from "./richText";

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
