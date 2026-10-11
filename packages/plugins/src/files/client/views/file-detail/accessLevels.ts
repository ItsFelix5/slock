export interface AccessOption {
  label: string;
  value: string;
}

export const ACCESS_OPTIONS: AccessOption[] = [
  { label: "Can view", value: "read" },
  { label: "Can comment", value: "comment" },
  { label: "Can edit", value: "write" },
];

export const ORG_ACCESS_OPTIONS: AccessOption[] = [
  { label: "No access", value: "none" },
  ...ACCESS_OPTIONS,
];

export function accessLabel(options: AccessOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
