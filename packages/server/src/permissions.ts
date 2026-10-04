import type { Credentials } from "./auth.ts";
import { callSlack, type SlackReply } from "./slackClient.ts";
import type { ChannelReply, RoleAssignmentsReply, UserReply } from "./slackReplies.ts";

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

export async function isChannelManager(
  channelId: string,
  userId: string,
  creds: Credentials | null,
): Promise<boolean> {
  const [userData, channelData, assignments] = await Promise.all([
    callSlack<UserReply>("users.info", { user: userId }, creds),
    callSlack<ChannelReply>("conversations.info", { channel: channelId }, creds),
    fetchChannelManagerAssignments(channelId, creds),
  ]);
  if (userData.ok && (userData.user?.is_admin || userData.user?.is_owner)) return true;
  if (channelData.ok && channelData.channel?.creator === userId) return true;
  return assignments.ok && managerIdsFromAssignments(assignments).includes(userId);
}
