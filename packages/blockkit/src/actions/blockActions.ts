import { apiPost } from "@slock/slack/client";
import type { AttachmentAction, ChannelId, Option, OptionGroup, Ts } from "@slock/types";
import type { BlockActionContext } from "../BlockKit";

export function containerOf(ctx: BlockActionContext) {
  if (ctx.view) return { type: "view", view_id: ctx.view.id };
  const message = {
    channel_id: ctx.channelId,
    is_ephemeral: ctx.isEphemeral ?? false,
    message_ts: ctx.messageTs,
  };
  return ctx.attachmentId === undefined
    ? { ...message, type: "message" }
    : { ...message, attachment_id: ctx.attachmentId, type: "message_attachment" };
}

export async function fetchExternalOptions(
  ctx: BlockActionContext,
  params: { actionId: string; blockId?: string; value: string },
) {
  if (!ctx.botId) throw new Error("This menu needs its app");
  const data = await apiPost<{
    option_groups?: OptionGroup[];
    options?: Option[];
  }>("/api/blocks/suggestions", {
    ...params,
    botId: ctx.botId,
    botTeamId: ctx.botTeamId,
    container: containerOf(ctx),
  });
  if (!data.ok) throw new Error(data.error ?? "blocks.suggestions failed");
  return { groups: data.option_groups, options: data.options };
}

export async function runBlockAction(params: {
  action: Record<string, unknown>;
  botId: string;
  botTeamId?: string;
  container: Record<string, unknown>;
  state?: unknown;
}): Promise<void> {
  const data = await apiPost("/api/blocks/actions", params);
  if (!data.ok) throw new Error(data.error ?? "blocks.actions failed");
}

export async function runAttachmentAction(params: {
  action: AttachmentAction;
  attachmentId: number;
  botId: string;
  botUserId: string;
  callbackId: string;
  channelId: ChannelId;
  isEphemeral: boolean;
  messageTs: Ts;
}): Promise<void> {
  const data = await apiPost("/api/attachments/actions", params);
  if (!data.ok) throw new Error(data.error ?? "chat.attachmentAction failed");
}
