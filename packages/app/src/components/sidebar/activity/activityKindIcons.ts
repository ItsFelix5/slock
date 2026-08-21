import type { IconName } from "@slock/ui";
import type { ActivityItem } from "../../../lib/api";

export const ACTIVITY_KIND_ICONS: Record<ActivityItem["kind"], IconName> = {
  channel_all: "notifications-all-new-posts",
  channel_mention: "megaphone",
  dm: "direct-messages",
  keyword: "sparkles",
  mention: "mentions",
  other: "notifications",
  reaction: "emoji",
  thread_reply: "threads",
  usergroup_mention: "user-groups",
};
