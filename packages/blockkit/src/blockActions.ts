import { apiGet, apiPost } from "@slock/slack";
import type { AttachmentAction, RawBot } from "@slock/types";

async function fetchBotAppInfo(botId: string): Promise<{ appId: string } | null> {
  const data = await apiGet<{ bot: RawBot }>(`/api/bots/${botId}`);
  if (!data.ok) throw new Error(data.error ?? "bots.info failed");
  return data.bot.app_id ? { appId: data.bot.app_id } : null;
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
