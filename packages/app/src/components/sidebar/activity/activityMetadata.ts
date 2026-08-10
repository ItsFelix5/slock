import type { ActivityItem } from "@slock/slack-api";

function otherActivityLabel(type?: string): string {
  switch (type) {
    case "saved_reminder":
      return "Reminded you";
    case "quietly_added_to_channel":
      return "Added you to this channel";
    case "internal_channel_invite":
    case "external_channel_invite":
    case "external_dm_invite":
      return "Invited you";
    case "list_approval_request":
      return "Approval requested";
    case "list_approval_reviewed":
      return "Approval reviewed";
    case "list_record_assigned":
      return "Record assigned";
    case "list_record_edited":
      return "Record edited";
    case "list_todo_notification":
      return "To-do notification";
    case "list_user_mentioned":
      return "Mentioned in a list";
    default:
      return "Other activity";
  }
}

export function activityVerb(item: ActivityItem): string {
  switch (item.kind) {
    case "mention":
      return "Mentioned you";
    case "dm":
      return item.activityType === "bot_dm_bundle" ? "Sent an app message" : "Sent you a message";
    case "keyword":
      return item.matchedKeyword ? `Said “${item.matchedKeyword}”` : "Used a pingword";
    case "thread_reply":
      return "Replied in a thread";
    case "channel_mention":
      if (item.activityType === "unjoined_channel_mention") return "Mentioned you in a channel";
      return `Mentioned @${item.broadcastRange ?? "channel"}`;
    case "usergroup_mention":
      return "Mentioned your usergroup";
    case "channel_all":
      return "Posted in a channel you follow";
    case "other":
      return otherActivityLabel(item.activityType);
    default:
      return "Reacted to your message";
  }
}
