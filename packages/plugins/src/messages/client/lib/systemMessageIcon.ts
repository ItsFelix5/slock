import type { IconName } from "@slock/ui";

const ICONS: Record<string, IconName> = {
  channel_archive: "archive",
  channel_convert_to_private: "lock",
  channel_convert_to_public: "unlock",
  channel_join: "user-add",
  channel_leave: "sign-out",
  channel_name: "edit",
  channel_purpose: "edit",
  channel_topic: "edit",
  channel_unarchive: "unarchive",
  group_archive: "archive",
  group_join: "user-add",
  group_leave: "sign-out",
  group_name: "edit",
  group_purpose: "edit",
  group_topic: "edit",
  group_unarchive: "unarchive",
  pinned_item: "pin",
  unpinned_item: "pin",
};

export function systemMessageIcon(subtype: string | undefined): IconName {
  return (subtype && ICONS[subtype]) || "info";
}
