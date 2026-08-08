import { ACTIVITY_KIND_FEED_TYPES, type ActivityItem } from "@slock/slack-api";
import type { IconName } from "@slock/ui";
import type { ActivityRow as ActivityRowData } from "./ActivityRow";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";

export type Tag = ActivityItem["kind"] | "app";
export type ReadState = "all" | "unread" | "read" | "reacted";
export type RowStatus = Exclude<ReadState, "all"> | "pending";

export type ActivityListEntry =
  | { day: string; kind: "divider" }
  | { key: string; kind: "row"; row: ActivityRowData };

export const TAG_FILTERS: { icon: IconName; key: Tag; label: string }[] = [
  { icon: ACTIVITY_KIND_ICONS.mention, key: "mention", label: "Mentions" },
  { icon: ACTIVITY_KIND_ICONS.dm, key: "dm", label: "Direct messages" },
  { icon: ACTIVITY_KIND_ICONS.keyword, key: "keyword", label: "Pingwords" },
  { icon: ACTIVITY_KIND_ICONS.thread_reply, key: "thread_reply", label: "Threads" },
  {
    icon: ACTIVITY_KIND_ICONS.channel_mention,
    key: "channel_mention",
    label: "@channel and @here",
  },
  { icon: ACTIVITY_KIND_ICONS.usergroup_mention, key: "usergroup_mention", label: "Usergroups" },
  { icon: ACTIVITY_KIND_ICONS.channel_all, key: "channel_all", label: "All channel posts" },
  { icon: ACTIVITY_KIND_ICONS.reaction, key: "reaction", label: "Reactions" },
  { icon: ACTIVITY_KIND_ICONS.reminder, key: "reminder", label: "Reminders" },
  { icon: ACTIVITY_KIND_ICONS.channel_invite, key: "channel_invite", label: "Invitations" },
  { icon: ACTIVITY_KIND_ICONS.list, key: "list", label: "Lists" },
  { icon: "apps", key: "app", label: "Apps" },
];

export const READ_STATES: { key: ReadState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "reacted", label: "Reacted" },
];

export function latestItem(row: ActivityRowData) {
  return row.items[0];
}

// Scopes activity.feed's `types` param to the selected category so paging
// through a narrow filter (e.g. just Reactions) doesn't have to wade through
// pages of every other kind first. "app" is a client-only split of dm items
// (bot senders), so it shares dm's wire type rather than having its own.
export function feedTypesForTag(tag: Tag | "all"): string | undefined {
  if (tag === "all") return;
  if (tag === "app") return ACTIVITY_KIND_FEED_TYPES.dm.join(",");
  return ACTIVITY_KIND_FEED_TYPES[tag].join(",");
}
