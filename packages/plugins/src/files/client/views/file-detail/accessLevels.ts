import type { IconName } from "@slock/ui";

export interface AccessOption {
  label: string;
  value: string;
}

export const ACCESS_OPTIONS: AccessOption[] = [
  { label: "Can edit", value: "write" },
  { label: "Can comment", value: "comment" },
  { label: "Can view", value: "read" },
];

export function orgAccessOptions(orgName = "the workspace"): AccessOption[] {
  return [
    { label: "Invite only", value: "none" },
    { label: `Anyone in ${orgName} can view`, value: "read" },
    { label: `Anyone in ${orgName} can comment`, value: "comment" },
    { label: `Anyone in ${orgName} can edit`, value: "write" },
  ];
}

export const ORG_ACCESS_ICONS: Record<string, IconName> = {
  comment: "comment",
  none: "lock",
  read: "globe",
  write: "edit",
};

export function accessLabel(options: AccessOption[], value: string): string {
  if (value === "owner") return "Owner";
  return options.find((option) => option.value === value)?.label ?? value;
}
