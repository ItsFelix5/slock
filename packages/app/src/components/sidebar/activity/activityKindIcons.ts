// biome-ignore-all lint/style/useNamingConvention: Keys intentionally match ActivityItem kind strings.
import type { ActivityItem } from "@slock/slack-api";
import type { IconName } from "@slock/ui";

export const ACTIVITY_KIND_ICONS: Record<ActivityItem["kind"], IconName> = {
  channel_all: "notifications-all-new-posts",
  channel_mention: "megaphone",
  dm: "direct-messages",
  keyword: "sparkles",
  mention: "mentions",
  reaction: "emoji",
  thread_reply: "threads",
  usergroup_mention: "user-groups",
};
