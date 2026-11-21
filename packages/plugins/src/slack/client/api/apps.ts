import { defineQuery } from "@slock/plugins/query/client/api";
import { apiGet, apiPost, replyError } from "@slock/slack";
import type { ChannelId, MessageShortcut, Ts } from "@slock/types";

interface AppDescriptionArg {
  appId: string;
  botId: string;
}

const appDescription = defineQuery<AppDescriptionArg, string>({
  load: async ({ appId, botId }) => {
    const data = await apiGet<{ desc?: string }>(
      `/api/apps/${appId}/profile?bot=${encodeURIComponent(botId)}`,
    );
    if (!data.ok) throw new Error(data.error ?? "apps.profile.get failed");
    return data.desc ?? "";
  },
  name: "appDescription",
});

export async function fetchMessageShortcuts(): Promise<MessageShortcut[]> {
  const data = await apiGet<{ shortcuts?: MessageShortcut[] }>("/api/message-shortcuts");
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
  if (!data.ok) throw new Error(data.error ?? "apps.actions.v2.execute failed");
  return data;
}

export async function fetchAppDescription(
  appId: string,
  botId: string,
): Promise<string | undefined> {
  return (await appDescription.ensure({ appId, botId })) || undefined;
}
