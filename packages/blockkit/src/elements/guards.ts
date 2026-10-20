import type {
  BlockElement,
  CheckboxRadioElement,
  DatePickerElement,
  FileInputElement,
  RichTextInputElement,
  SelectElement,
  TextInputElement,
} from "@slock/types";

const TEXT_INPUTS = ["plain_text_input", "email_text_input", "url_text_input", "number_input"];
const PICKERS = ["datepicker", "timepicker", "datetimepicker"];

export const isSelect = (el: BlockElement): el is SelectElement => el.type.endsWith("select");

export const isTextInput = (el: BlockElement): el is TextInputElement =>
  TEXT_INPUTS.includes(el.type);

export const isChoiceGroup = (el: BlockElement): el is CheckboxRadioElement =>
  el.type === "checkboxes" || el.type === "radio_buttons";

export const isPicker = (el: BlockElement): el is DatePickerElement => PICKERS.includes(el.type);

export const isFileInput = (el: BlockElement): el is FileInputElement => el.type === "file_input";

export const isRichTextInput = (el: BlockElement): el is RichTextInputElement =>
  el.type === "rich_text_input";
