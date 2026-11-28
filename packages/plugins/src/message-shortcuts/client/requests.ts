import { replyError } from "@slock/slack";
import { apiGet, apiPost } from "@slock/slack/client";
import type { ChannelId, MessageShortcut, Ts } from "@slock/types";

export async function fetchMessageShortcuts(signal: AbortSignal): Promise<MessageShortcut[]> {
  const data = await apiGet<{ shortcuts?: MessageShortcut[] }>("/api/message-shortcuts", signal);
  if (!data.ok) throw replyError(data, "client.appCommands failed");
  return (data.shortcuts ?? []).map((s) => ({
    ...s,
    icon: s.icon || undefined,
  }));
}

export async function runMessageShortcut(
  actionId: string,
  appId: string,
  channelId: ChannelId,
  messageTs: Ts,
) {
  const data = await apiPost(`/api/message-shortcuts/${actionId}/run`, {
    appId,
    channelId,
    messageTs,
  });
  if (!data.ok) throw replyError(data, "apps.actions.v2.execute failed");
  return data;
}
