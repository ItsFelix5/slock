import type { MessageShortcut } from "@slock/types";
import { apiGet, apiPost, getOrCreateRetryablePromise, resolveMediaUrl } from "@slock/types";

export async function fetchMessageShortcuts(): Promise<MessageShortcut[]> {
  const data = await apiGet("/api/message-shortcuts");
  if (!data.ok) throw new Error(data.error ?? "client.appCommands failed");
  const shortcuts: any[] = data.shortcuts ?? [];
  return shortcuts.map((s) => ({
    ...s,
    icon: s.icon ? resolveMediaUrl(s.icon) : undefined,
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

const appDescriptionCache = new Map<string, Promise<string | undefined>>();
export function fetchAppDescription(appId: string, botId: string): Promise<string | undefined> {
  return getOrCreateRetryablePromise(appDescriptionCache, appId, async () => {
    const data = await apiGet(`/api/apps/${appId}/profile?bot=${encodeURIComponent(botId)}`);
    if (!data.ok) throw new Error(data.error ?? "apps.profile.get failed");
    return data.desc || undefined;
  });
}
