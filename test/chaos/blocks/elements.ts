import { chance, int, pick, uid } from "../random";
import type { Obj } from "../slack";
import { imageUrl, words } from "../text";
import type { World } from "../world";

type ElementType =
  | "button"
  | "checkboxes"
  | "radio_buttons"
  | "overflow"
  | "datepicker"
  | "datetimepicker"
  | "timepicker"
  | "static_select"
  | "multi_static_select"
  | "users_select"
  | "multi_users_select"
  | "conversations_select"
  | "multi_conversations_select"
  | "channels_select"
  | "multi_channels_select"
  | "external_select"
  | "multi_external_select"
  | "image"
  | "feedback_buttons";

const plain = (text: string): Obj => ({ type: "plain_text", text, emoji: true });
const actionId = (): string => `act_${uid()}`;
const options = (count: number): Obj[] =>
  Array.from({ length: count }, (_, i) => ({ text: plain(`${words(2)} ${i}`), value: uid() }));
const withOptions = (type: string, count: number): Obj => ({
  type,
  action_id: actionId(),
  placeholder: plain(words(2)),
  options: options(count),
});
const checkboxes = (): Obj => {
  const opts = options(int(1, 8));
  return {
    type: "checkboxes",
    action_id: actionId(),
    options: opts,
    initial_options: opts.slice(0, 1),
  };
};
const radios = (): Obj => {
  const [first, ...rest] = options(int(1, 8));
  return {
    type: "radio_buttons",
    action_id: actionId(),
    options: [first, ...rest],
    initial_option: first,
  };
};
const picker = (type: string, key: string, value: unknown): Obj => ({
  type,
  action_id: actionId(),
  placeholder: plain(words(2)),
  [key]: value,
});

const makers: Record<ElementType, (w: World) => Obj> = {
  button: () => ({
    type: "button",
    text: plain(words(int(1, 3))),
    action_id: actionId(),
    value: uid(),
    ...(chance(0.3) ? { style: pick(["primary", "danger"]) } : {}),
  }),
  checkboxes,
  radio_buttons: radios,
  overflow: () => ({ type: "overflow", action_id: actionId(), options: options(int(2, 5)) }),
  datepicker: () => ({
    type: "datepicker",
    action_id: actionId(),
    placeholder: plain(words(2)),
    initial_date: "2026-11-26",
  }),
  datetimepicker: () => ({
    type: "datetimepicker",
    action_id: actionId(),
    initial_date_time: 1795680000 + int(0, 9000000),
  }),
  timepicker: () => ({
    type: "timepicker",
    action_id: actionId(),
    initial_time: "09:41",
    placeholder: plain("time"),
  }),
  static_select: () => withOptions("static_select", int(1, 100)),
  multi_static_select: () => withOptions("multi_static_select", int(1, 100)),
  users_select: (w) => picker("users_select", "initial_user", pick(w.users)),
  multi_users_select: (w) => picker("multi_users_select", "initial_users", [pick(w.users)]),
  conversations_select: (w) =>
    picker("conversations_select", "initial_conversation", pick(w.channels)),
  multi_conversations_select: (w) =>
    picker("multi_conversations_select", "initial_conversations", [pick(w.channels)]),
  channels_select: (w) => picker("channels_select", "initial_channel", pick(w.channels)),
  multi_channels_select: (w) =>
    picker("multi_channels_select", "initial_channels", [pick(w.channels)]),
  external_select: () => picker("external_select", "min_query_length", int(0, 3)),
  multi_external_select: () => picker("multi_external_select", "min_query_length", 0),
  image: () => ({ type: "image", image_url: imageUrl(), alt_text: words(2) }),
  feedback_buttons: () => ({
    type: "feedback_buttons",
    action_id: actionId(),
    positive_button: { text: plain("👍"), value: uid() },
    negative_button: { text: plain("👎"), value: uid() },
  }),
};

const ACCESSORY_TYPES: ElementType[] = [
  "button",
  "checkboxes",
  "radio_buttons",
  "overflow",
  "datepicker",
  "timepicker",
  "static_select",
  "multi_static_select",
  "users_select",
  "multi_users_select",
  "conversations_select",
  "multi_conversations_select",
  "channels_select",
  "multi_channels_select",
  "external_select",
  "multi_external_select",
  "image",
];

const ACTION_TYPES: ElementType[] = [
  "button",
  "checkboxes",
  "radio_buttons",
  "overflow",
  "datepicker",
  "datetimepicker",
  "timepicker",
  "static_select",
  "users_select",
  "conversations_select",
  "channels_select",
  "external_select",
];

export const element = (type: ElementType, w: World): Obj => makers[type](w);
export const accessory = (w: World): Obj => element(pick(ACCESSORY_TYPES), w);
export const actionsBlock = (w: World): Obj => ({
  type: "actions",
  elements: Array.from({ length: int(1, 25) }, () => element(pick(ACTION_TYPES), w)),
});
export const contextActions = (w: World): Obj => ({
  type: "context_actions",
  elements: [element("feedback_buttons", w)],
});
