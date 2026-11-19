import { narrowByType } from "@slock/core";
import type { ActionsBlock, Block, InputBlock, SectionBlock } from "@slock/types";

type Payload = Record<string, unknown>;
type ElementData = {
  action_id?: string;
  initial_channel?: string;
  initial_channels?: string[];
  initial_conversation?: string;
  initial_conversations?: string[];
  initial_date?: string;
  initial_datetime?: number;
  initial_option?: unknown;
  initial_options?: unknown[];
  initial_time?: string;
  initial_user?: string;
  initial_users?: string[];
  initial_value?: unknown;
  type: string;
};

export type ViewValues = { values: Record<string, Record<string, Payload>> };

export interface ViewState {
  record(blockId: string | undefined, actionId: string, payload: Payload): void;
  snapshot(blocks: Block[]): ViewValues;
}

const STATELESS = [
  "button",
  "feedback_buttons",
  "icon_button",
  "image",
  "overflow",
  "workflow_button",
];

const EMPTY: Record<string, Payload> = {
  channels_select: { selected_channel: null },
  checkboxes: { selected_options: [] },
  conversations_select: { selected_conversation: null },
  datepicker: { selected_date: null },
  datetimepicker: { selected_date_time: null },
  external_select: { selected_option: null },
  file_input: { files: [] },
  multi_channels_select: { selected_channels: [] },
  multi_conversations_select: { selected_conversations: [] },
  multi_external_select: { selected_options: [] },
  multi_static_select: { selected_options: [] },
  multi_users_select: { selected_users: [] },
  radio_buttons: { selected_option: null },
  rich_text_input: { rich_text_value: null },
  static_select: { selected_option: null },
  timepicker: { selected_time: null },
  users_select: { selected_user: null },
};

function initialPayload(el: ElementData): Payload | undefined {
  if (typeof el.initial_value === "string") return { type: el.type, value: el.initial_value };
  if (el.type === "rich_text_input" && el.initial_value) {
    return { rich_text_value: el.initial_value, type: el.type };
  }
  if (el.initial_option) return { selected_option: el.initial_option, type: el.type };
  if (el.initial_options) return { selected_options: el.initial_options, type: el.type };
  if (el.initial_user) return { selected_user: el.initial_user, type: el.type };
  if (el.initial_users) return { selected_users: el.initial_users, type: el.type };
  if (el.initial_conversation)
    return { selected_conversation: el.initial_conversation, type: el.type };
  if (el.initial_conversations)
    return { selected_conversations: el.initial_conversations, type: el.type };
  if (el.initial_channel) return { selected_channel: el.initial_channel, type: el.type };
  if (el.initial_channels) return { selected_channels: el.initial_channels, type: el.type };
  if (el.initial_date) return { selected_date: el.initial_date, type: el.type };
  if (el.initial_time) return { selected_time: el.initial_time, type: el.type };
  if (el.initial_datetime) return { selected_date_time: el.initial_datetime, type: el.type };
}

export function statefulElements(blocks: Block[]) {
  const found: { blockId: string; element: ElementData; optional: boolean }[] = [];
  for (const block of blocks) {
    const input = narrowByType<Block, InputBlock>(block, "input");
    const section = narrowByType<Block, SectionBlock>(block, "section");
    const actions = narrowByType<Block, ActionsBlock>(block, "actions");
    const candidates = [input?.element, section?.accessory, ...(actions?.elements ?? [])];
    for (const element of candidates) {
      const data: ElementData | undefined = element;
      if (!(data?.action_id && block.block_id) || STATELESS.includes(data.type)) continue;
      found.push({ blockId: block.block_id, element: data, optional: !!input?.optional });
    }
  }
  return found;
}

export function createViewState(onChange?: (blockId: string) => void): ViewState {
  const recorded = new Map<string, Map<string, Payload>>();

  return {
    record(blockId, actionId, payload) {
      if (!blockId) return;
      const block = recorded.get(blockId) ?? new Map<string, Payload>();
      block.set(actionId, payload);
      recorded.set(blockId, block);
      onChange?.(blockId);
    },
    snapshot(blocks) {
      const values: ViewValues["values"] = {};
      for (const { blockId, element } of statefulElements(blocks)) {
        const actionId = element.action_id ?? "";
        const payload = recorded.get(blockId)?.get(actionId) ??
          initialPayload(element) ?? {
            ...(EMPTY[element.type] ?? { value: null }),
            type: element.type,
          };
        values[blockId] = { ...values[blockId], [actionId]: payload };
      }
      return { values };
    },
  };
}
