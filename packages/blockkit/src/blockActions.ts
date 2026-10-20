import { apiGet, apiPost } from "@slock/slack";
import type { AttachmentAction, Option, OptionGroup, RawBot } from "@slock/types";
import type { BlockActionContext } from "./BlockKit";

async function fetchBotAppInfo(botId: string): Promise<{ appId: string } | null> {
  const data = await apiGet<{ bot: RawBot }>(`/api/bots/${botId}`);
  if (!data.ok) throw new Error(data.error ?? "bots.info failed");
  return data.bot.app_id ? { appId: data.bot.app_id } : null;
}

export function containerOf(ctx: BlockActionContext) {
  return ctx.view
    ? { type: "view", view_id: ctx.view.id }
    : {
        channel_id: ctx.channelId,
        is_ephemeral: false,
        message_ts: ctx.messageTs,
        type: "message",
      };
}

export async function fetchExternalOptions(
  ctx: BlockActionContext,
  params: { actionId: string; blockId?: string; value: string },
) {
  if (!ctx.botId) throw new Error("This menu needs its app");
  const appId = ctx.appId ?? (await fetchBotAppInfo(ctx.botId))?.appId;
  if (!appId) throw new Error("Couldn't resolve the app behind this menu");
  const data = await apiPost<{ option_groups?: OptionGroup[]; options?: Option[] }>(
    "/api/blocks/suggestions",
    { ...params, appId, botId: ctx.botId, container: containerOf(ctx) },
  );
  if (!data.ok) throw new Error(data.error ?? "blocks.suggestions failed");
  return { groups: data.option_groups, options: data.options };
}

export async function runBlockAction(params: {
  action: Record<string, unknown>;
  appId?: string;
  botId: string;
  container: Record<string, unknown>;
  state?: unknown;
}): Promise<void> {
  const appId = params.appId ?? (await fetchBotAppInfo(params.botId))?.appId;
  if (!appId) throw new Error("Couldn't resolve the app behind this button");
  const data = await apiPost("/api/blocks/actions", { ...params, appId });
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
