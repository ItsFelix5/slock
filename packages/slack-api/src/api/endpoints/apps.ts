import type { MessageShortcut } from "../../types";
import { getOrCreateRetryablePromise } from "../cache/retryablePromiseCache";
import { apiGet, apiPost, resolveMediaUrl } from "../server";

export async function fetchMessageShortcuts(): Promise<MessageShortcut[]> {
  const data = await apiGet("/api/message-shortcuts");
  if (!data.ok) throw new Error(data.error ?? "client.appCommands failed");
  const shortcuts: any[] = data.shortcuts ?? [];
  return shortcuts.map((s) => ({ ...s, icon: s.icon ? resolveMediaUrl(s.icon) : undefined }));
}

// Fire-and-forget: the app receives the message via its own interactivity
// endpoint and responds asynchronously (e.g. an ephemeral message or modal),
// not through this call's result.
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

// bots.info's `app_id` is needed to submit a block action (see runBlockAction)
// but isn't worth a field on every mapped message — resolved lazily per bot id
// instead, and cached since it never changes at runtime.
const botAppInfoCache = new Map<string, Promise<{ appId: string } | null>>();
function fetchBotAppInfo(botId: string): Promise<{ appId: string } | null> {
  return getOrCreateRetryablePromise(botAppInfoCache, botId, async () => {
    const data = await apiGet(`/api/bots/${botId}`);
    if (!data.ok) throw new Error(data.error ?? "bots.info failed");
    return data.bot?.app_id ? { appId: data.bot.app_id } : null;
  });
}

// Powers the app "About" flyout Slack's own client shows for a bot user.
// Cached per app id — it never changes at runtime, and every bot user of the
// same app shares one description.
const appDescriptionCache = new Map<string, Promise<string | undefined>>();
export function fetchAppDescription(appId: string, botId: string): Promise<string | undefined> {
  return getOrCreateRetryablePromise(appDescriptionCache, appId, async () => {
    const data = await apiGet(`/api/apps/${appId}/profile?bot=${encodeURIComponent(botId)}`);
    if (!data.ok) throw new Error(data.error ?? "apps.profile.get failed");
    return data.desc || undefined;
  });
}

// Dispatches a Block Kit button click. Fire-and-forget, like
// runMessageShortcut: the app receives it via its own interactivity endpoint
// and responds asynchronously (e.g. updating the message), not through this
// call's result.
export async function runBlockAction(params: {
  actionId: string;
  blockId?: string;
  botId: string;
  buttonText: string;
  channelId: string;
  messageTs: string;
  value?: string;
}): Promise<void> {
  const botInfo = await fetchBotAppInfo(params.botId);
  if (!botInfo) throw new Error("Couldn't resolve the app behind this button");
  const data = await apiPost("/api/blocks/actions", {
    actionId: params.actionId,
    appId: botInfo.appId,
    blockId: params.blockId,
    botId: params.botId,
    buttonText: params.buttonText,
    channelId: params.channelId,
    messageTs: params.messageTs,
    value: params.value,
  });
  if (!data.ok) throw new Error(data.error ?? "blocks.actions failed");
}
