import type { Credentials } from "./auth";
import { callSlack, type SlackReply } from "./slackClient";
import type { RoleAssignmentsReply } from "./slackReplies";

export function fetchChannelManagerAssignments(
  channelId: string,
  creds: Credentials | null,
): Promise<SlackReply<RoleAssignmentsReply>> {
  return callSlack<RoleAssignmentsReply>(
    "admin.roles.entity.listAssignments",
    { entity_id: channelId },
    creds,
  );
}

export function managerIdsFromAssignments(data: RoleAssignmentsReply): string[] {
  return [...new Set((data.role_assignments ?? []).flatMap((a) => a.users ?? []))];
}
