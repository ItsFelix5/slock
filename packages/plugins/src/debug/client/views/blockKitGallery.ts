import type { Block, Option, TextObject } from "@slock/types";

const plain = (text: string): TextObject => ({ text, type: "plain_text" });
const option = (text: string, value = text.toLowerCase(), description?: string): Option => ({
  ...(description ? { description: plain(description) } : {}),
  text: plain(text),
  value,
});

const fruits = ["Apple", "Banana", "Cherry", "Durian", "Elderberry", "Fig"].map((f) => option(f));

export const galleryBlocks: Block[] = [
  {
    block_id: "text",
    element: {
      action_id: "a",
      initial_value: "hello",
      placeholder: plain("Text"),
      type: "plain_text_input",
    },
    label: plain("Plain text"),
    type: "input",
  },
  {
    block_id: "text_ml",
    element: { action_id: "a", max_length: 40, multiline: true, type: "plain_text_input" },
    label: plain("Multiline (max 40)"),
    optional: true,
    type: "input",
  },
  {
    block_id: "email",
    element: { action_id: "a", type: "email_text_input" },
    label: plain("Email"),
    type: "input",
  },
  {
    block_id: "url",
    element: { action_id: "a", type: "url_text_input" },
    label: plain("URL"),
    type: "input",
  },
  {
    block_id: "number",
    element: {
      action_id: "a",
      is_decimal_allowed: false,
      max_value: "10",
      min_value: "1",
      type: "number_input",
    },
    label: plain("Whole number 1 to 10"),
    type: "input",
  },
  {
    block_id: "rich",
    element: { action_id: "a", type: "rich_text_input" },
    label: plain("Rich text"),
    type: "input",
  },
  {
    block_id: "date",
    element: { action_id: "a", initial_date: "2026-10-06", type: "datepicker" },
    label: plain("Date"),
    type: "input",
  },
  {
    block_id: "time",
    element: { action_id: "a", type: "timepicker" },
    label: plain("Time"),
    optional: true,
    type: "input",
  },
  {
    block_id: "datetime",
    element: { action_id: "a", initial_datetime: 1790000000, type: "datetimepicker" },
    label: plain("Date and time"),
    optional: true,
    type: "input",
  },
  {
    block_id: "static",
    element: {
      action_id: "a",
      initial_option: option("Banana"),
      options: fruits,
      type: "static_select",
    },
    label: plain("Static select"),
    type: "input",
  },
  {
    block_id: "static_groups",
    element: {
      action_id: "a",
      option_groups: [
        { label: plain("Sweet"), options: fruits.slice(0, 3) },
        { label: plain("Odd"), options: fruits.slice(3) },
      ],
      type: "static_select",
    },
    label: plain("Grouped select"),
    optional: true,
    type: "input",
  },
  {
    block_id: "multi",
    element: {
      action_id: "a",
      initial_options: [option("Apple")],
      max_selected_items: 3,
      options: fruits,
      type: "multi_static_select",
    },
    label: plain("Multi select (max 3)"),
    type: "input",
  },
  {
    block_id: "user",
    element: { action_id: "a", type: "users_select" },
    label: plain("User"),
    optional: true,
    type: "input",
  },
  {
    block_id: "users",
    element: { action_id: "a", type: "multi_users_select" },
    label: plain("Users"),
    optional: true,
    type: "input",
  },
  {
    block_id: "conversation",
    element: {
      action_id: "a",
      default_to_current_conversation: true,
      type: "conversations_select",
    },
    label: plain("Conversation (defaults to current)"),
    optional: true,
    type: "input",
  },
  {
    block_id: "conversations",
    element: {
      action_id: "a",
      filter: { include: ["public", "private"] },
      type: "multi_conversations_select",
    },
    label: plain("Conversations (channels only)"),
    optional: true,
    type: "input",
  },
  {
    block_id: "channel",
    element: { action_id: "a", type: "channels_select" },
    label: plain("Channel"),
    optional: true,
    type: "input",
  },
  {
    block_id: "channels",
    element: { action_id: "a", type: "multi_channels_select" },
    label: plain("Channels"),
    optional: true,
    type: "input",
  },
  {
    block_id: "external",
    element: { action_id: "a", type: "external_select" },
    label: plain("External select (needs an app)"),
    optional: true,
    type: "input",
  },
  {
    block_id: "checks",
    element: {
      action_id: "a",
      initial_options: [option("Two")],
      options: [
        option("One", "one", "First choice"),
        option("Two", "two", "Second choice"),
        option("Three"),
      ],
      type: "checkboxes",
    },
    label: plain("Checkboxes"),
    optional: true,
    type: "input",
  },
  {
    block_id: "radio",
    element: {
      action_id: "a",
      initial_option: option("Beta"),
      options: [option("Alpha", "alpha", "Described"), option("Beta"), option("Gamma")],
      type: "radio_buttons",
    },
    label: plain("Radio buttons"),
    type: "input",
  },
  {
    block_id: "file",
    element: { action_id: "a", filetypes: ["png", "txt"], max_files: 2, type: "file_input" },
    label: plain("Files (png, txt, max 2)"),
    optional: true,
    type: "input",
  },
  {
    accessory: { action_id: "a", options: fruits, type: "static_select" },
    block_id: "section_select",
    text: { text: "Section accessory select", type: "mrkdwn" },
    type: "section",
  },
  {
    block_id: "actions",
    elements: [
      { action_id: "a", initial_date: "2026-01-01", type: "datepicker" },
      { action_id: "b", options: [option("Left"), option("Right")], type: "static_select" },
    ],
    type: "actions",
  },
];
