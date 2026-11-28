import { mapChannel, parseChannelId, replyError } from "@slock/slack";
import { apiPost } from "@slock/slack/client";
import type { Channel, ChannelId, RawChannel, UserId } from "@slock/types";

export async function createChannel(name: string, isPrivate: boolean): Promise<Channel> {
  const data = await apiPost<{ channel: RawChannel }>("/api/channels", { isPrivate, name });
  if (!data.ok) throw replyError(data, "conversations.create failed");
  return mapChannel(data.channel);
}

export async function openGroupDm(userIds: UserId[]): Promise<ChannelId> {
  const data = await apiPost<{ channel: { id: string } }>("/api/dms", { userIds });
  if (!data.ok) throw replyError(data, "conversations.open failed");
  return parseChannelId(data.channel.id);
}

export async function createUsergroup(name: string): Promise<string> {
  const data = await apiPost<{ id?: string }>("/api/usergroups", { name });
  if (!data.ok) throw replyError(data, "usergroups.create failed");
  if (!data.id) throw new Error("usergroups.create returned no id");
  return data.id;
}
