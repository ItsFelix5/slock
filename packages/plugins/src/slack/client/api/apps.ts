import { service } from "@slock/core/solid";
import { ApiError, apiGet, apiPost } from "@slock/slack";
import type { MessageShortcut } from "@slock/types";
import { defineKey } from "../../../query/client/api";

const appDescriptionKey = defineKey<[string]>("appDescription");

export async function fetchMessageShortcuts(): Promise<MessageShortcut[]> {
  const data = await apiGet<{ shortcuts?: MessageShortcut[] }>("/api/message-shortcuts");
  if (!data.ok) throw new ApiError(data.error ?? "client.appCommands failed", data.retry_after);
  return (data.shortcuts ?? []).map((s) => ({
    ...s,
    icon: s.icon || undefined,
  }));
}

export async function runMessageShortcut(
  actionId: string,
  appId: string,
  channelId: string,
  messageTs: string,
) {
  const data = await apiPost(`/api/message-shortcuts/${actionId}/run`, {
    appId,
    channelId,
    messageTs,
  });
  if (!data.ok) throw new Error(data.error ?? "apps.actions.v2.execute failed");
  return data;
}

const query = service("query");

export async function fetchAppDescription(
  appId: string,
  botId: string,
): Promise<string | undefined> {
  const desc = await query.client.query({
    queryFn: async () => {
      const data = await apiGet<{ desc?: string }>(
        `/api/apps/${appId}/profile?bot=${encodeURIComponent(botId)}`,
      );
      if (!data.ok) throw new Error(data.error ?? "apps.profile.get failed");
      return data.desc ?? "";
    },
    queryKey: appDescriptionKey(appId),
    staleTime: Infinity,
  });
  return desc || undefined;
}
