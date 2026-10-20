import type { Option, OptionGroup } from "@slock/types";
import type { ComboboxOption } from "@slock/ui";

export const optionKey = (option: Option) => option.value ?? option.text.text;

export const optionPayload = (option: Option) => ({
  text: option.text,
  ...(option.description ? { description: option.description } : {}),
  ...(option.value === undefined ? {} : { value: option.value }),
});

export function flattenOptions(options?: Option[], groups?: OptionGroup[]) {
  return [
    ...(options ?? []).map((option) => ({ option })),
    ...(groups ?? []).flatMap((group) =>
      group.options.map((option) => ({ group: group.label.text, option })),
    ),
  ];
}

export function toComboboxOption(option: Option, group?: string): ComboboxOption {
  return {
    description: option.description?.text ?? group,
    id: optionKey(option),
    label: option.text.text,
  };
}
