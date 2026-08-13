import type { AttachmentAction, MessageShortcut } from "../../types";
import { getOrCreateRetryablePromise } from "../cache/retryablePromiseCache";
import { apiGet, apiPost, resolveMediaUrl } from "../server";

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

const botAppInfoCache = new Map<string, Promise<{ appId: string } | null>>();
function fetchBotAppInfo(botId: string): Promise<{ appId: string } | null> {
  return getOrCreateRetryablePromise(botAppInfoCache, botId, async () => {
    const data = await apiGet(`/api/bots/${botId}`);
    if (!data.ok) throw new Error(data.error ?? "bots.info failed");
    return data.bot?.app_id ? { appId: data.bot.app_id } : null;
  });
}

const appDescriptionCache = new Map<string, Promise<string | undefined>>();
export function fetchAppDescription(appId: string, botId: string): Promise<string | undefined> {
  return getOrCreateRetryablePromise(appDescriptionCache, appId, async () => {
    const data = await apiGet(`/api/apps/${appId}/profile?bot=${encodeURIComponent(botId)}`);
    if (!data.ok) throw new Error(data.error ?? "apps.profile.get failed");
    return data.desc || undefined;
  });
}

export async function runBlockAction(params: {
  action: Record<string, unknown>;
  botId: string;
  channelId: string;
  messageTs: string;
}): Promise<void> {
  const botInfo = await fetchBotAppInfo(params.botId);
  if (!botInfo) throw new Error("Couldn't resolve the app behind this button");
  const data = await apiPost("/api/blocks/actions", {
    action: params.action,
    appId: botInfo.appId,
    botId: params.botId,
    channelId: params.channelId,
    messageTs: params.messageTs,
  });
  if (!data.ok) throw new Error(data.error ?? "blocks.actions failed");
}

export async function runAttachmentAction(params: {
  action: AttachmentAction;
  attachmentId: number;
  botId: string;
  botUserId: string;
  callbackId: string;
  channelId: string;
  isEphemeral: boolean;
  messageTs: string;
}): Promise<void> {
  const data = await apiPost("/api/attachments/actions", params);
  if (!data.ok) throw new Error(data.error ?? "chat.attachmentAction failed");
}
