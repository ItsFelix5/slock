import type { Credentials } from "./auth.ts";
import { callSlack } from "./slackClient.ts";

export function fetchChannelManagerAssignments(
  channelId: string,
  creds: Credentials | null,
): Promise<any> {
  return callSlack("admin.roles.entity.listAssignments", { entity_id: channelId }, creds);
}

export function managerIdsFromAssignments(data: any): string[] {
  const assignments: any[] = Array.isArray(data.role_assignments) ? data.role_assignments : [];
  return [...new Set(assignments.flatMap((a) => a.users ?? []))];
}

export async function isChannelManager(
  channelId: string,
  userId: string,
  creds: Credentials | null,
): Promise<boolean> {
  const [userData, channelData, assignments] = await Promise.all([
    callSlack("users.info", { user: userId }, creds),
    callSlack("conversations.info", { channel: channelId }, creds),
    fetchChannelManagerAssignments(channelId, creds),
  ]);
  if (userData.ok && (userData.user?.is_admin || userData.user?.is_owner)) return true;
  if (channelData.ok && channelData.channel?.creator === userId) return true;
  return assignments.ok && managerIdsFromAssignments(assignments).includes(userId);
}
