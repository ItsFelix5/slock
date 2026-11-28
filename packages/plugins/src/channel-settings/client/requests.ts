import { replyError } from "@slock/slack";
import { apiGet, apiPut } from "@slock/slack/client";
import type { ChannelId, MemberPermissionsPatch } from "@slock/types";

function serializeMemberPermissionsPatch(patch: MemberPermissionsPatch): {
  is_allowed: boolean;
  permission: string;
}[] {
  const permissions: { is_allowed: boolean; permission: string }[] = [];
  if (patch.invite !== undefined) {
    permissions.push({
      is_allowed: patch.invite,
      permission: "INVITE_TO_CHANNEL",
    });
  }
  if (patch.setPurpose !== undefined) {
    permissions.push({
      is_allowed: patch.setPurpose,
      permission: "SET_CHANNEL_PURPOSE",
    });
  }
  if (patch.setTopic !== undefined) {
    permissions.push({
      is_allowed: patch.setTopic,
      permission: "SET_CHANNEL_TOPIC",
    });
  }
  return permissions;
}

export async function fetchChannelRetention(
  channelId: ChannelId,
  signal: AbortSignal,
): Promise<number | null> {
  const data = await apiGet<{ days?: number | null }>(
    `/api/channels/${channelId}/retention`,
    signal,
  );
  if (!data.ok) throw replyError(data, "conversations.getRetention failed");
  return data.days ?? null;
}

export async function fetchMemberPermissions(
  channelId: ChannelId,
  signal: AbortSignal,
): Promise<Required<MemberPermissionsPatch>> {
  const data = await apiGet<Required<MemberPermissionsPatch>>(
    `/api/channels/${channelId}/member-permissions`,
    signal,
  );
  if (!data.ok) throw replyError(data, "conversations.permissions.accountTypes.list failed");
  return { invite: data.invite, setPurpose: data.setPurpose, setTopic: data.setTopic };
}

export async function setChannelRetention(
  channelId: ChannelId,
  days: number | null,
): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/retention`, { days });
  if (!data.ok) throw replyError(data, "conversations.setRetention failed");
}

export async function setMemberPermissions(
  channelId: ChannelId,
  patch: MemberPermissionsPatch,
): Promise<void> {
  const permissions = serializeMemberPermissionsPatch(patch);
  if (permissions.length === 0) return;
  const data = await apiPut(`/api/channels/${channelId}/member-permissions`, {
    permissions,
  });
  if (!data.ok) throw replyError(data, "conversations.permissions.accountTypes.set failed");
}
