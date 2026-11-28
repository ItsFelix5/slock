import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import { callSlack, type SlackReply } from "@slock/plugins/slack/server/api/slackClient";
import type { RoleAssignmentsReply } from "@slock/plugins/slack/server/api/slackReplies";
import { parseUserId } from "@slock/slack";
import type { ChannelId, UserId } from "@slock/types";

export const CHANNEL_MANAGER_ROLE_ID = "Rl0A";

export function fetchChannelManagerAssignments(
  channelId: ChannelId,
  creds: Credentials | null,
): Promise<SlackReply<RoleAssignmentsReply>> {
  return callSlack<RoleAssignmentsReply>(
    "admin.roles.entity.listAssignments",
    { entity_id: channelId },
    creds,
  );
}

export function managerIdsFromAssignments(data: RoleAssignmentsReply): UserId[] {
  return [...new Set((data.role_assignments ?? []).flatMap((a) => a.users ?? []))].map(parseUserId);
}
