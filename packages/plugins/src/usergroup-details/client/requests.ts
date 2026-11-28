import { replyError } from "@slock/slack";
import { apiPatch, apiPut } from "@slock/slack/client";
import type { ChannelId, UserId } from "@slock/types";

export async function updateUsergroupProfile(
  id: string,
  patch: { name?: string; handle?: string; description?: string },
): Promise<void> {
  const data = await apiPatch(`/api/usergroups/${id}`, patch);
  if (!data.ok) throw replyError(data, "usergroups.update failed");
}

export async function setUsergroupMembers(id: string, userIds: UserId[]): Promise<void> {
  const data = await apiPut(`/api/usergroups/${id}/members`, { userIds });
  if (!data.ok) throw replyError(data, "usergroups.users.update failed");
}

export async function setUsergroupChannels(id: string, channelIds: ChannelId[]): Promise<void> {
  const data = await apiPatch(`/api/usergroups/${id}`, { channelIds });
  if (!data.ok) throw replyError(data, "usergroups.update failed");
}

export async function setUsergroupSectionEnabled(id: string, enabled: boolean): Promise<void> {
  const data = await apiPatch(`/api/usergroups/${id}`, {
    sectionEnabled: enabled,
  });
  if (!data.ok) throw replyError(data, "usergroups.update failed");
}
