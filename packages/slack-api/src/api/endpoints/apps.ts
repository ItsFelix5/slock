// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { MessageShortcut } from "../../types";
import { callSlack, fileProxyUrl, getWorkspaceTeamId } from "../relay";

// client.appCommands' `app_actions` list mixes every action any installed
// app registered — global shortcuts (composer lightning bolt) and
// per-message shortcuts share this one list, distinguished only by `type`
// ("commands", a sibling field, is slash commands and is unrelated). We only
// care about "message_action" here.
export async function fetchMessageShortcuts(): Promise<MessageShortcut[]> {
  const data = await callSlack("client.appCommands", {
    _x_reason: "app-commands-conditional-fetching",
  });
  if (!data.ok) return [];
  const apps: any[] = data.app_actions ?? [];
  const shortcuts: MessageShortcut[] = [];
  for (const app of apps) {
    const rawIcon =
      app.icons?.image_48 ?? app.icons?.image_72 ?? app.icons?.image_32 ?? app.icons?.image_64;
    const icon = rawIcon ? fileProxyUrl(rawIcon) : undefined;
    for (const action of app.actions ?? []) {
      if (action.type !== "message_action") continue;
      shortcuts.push({
        actionId: action.action_id,
        appId: app.app_id,
        appName: app.app_name,
        description: action.description ?? action.desc,
        icon,
        name: action.name,
      });
    }
  }
  return shortcuts;
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
  const data = await callSlack("apps.actions.v2.execute", {
    _x_reason: "message-shortcuts-menu",
    action_id: actionId,
    app_id: appId,
    client_token: `web-${Date.now()}`,
    context: JSON.stringify({ channel_id: channelId, message_ts: messageTs }),
  });
  if (!data.ok) throw new Error(data.error ?? "apps.actions.v2.execute failed");
  return data;
}

// bots.info's `app_id`/`user_id` are needed to submit a block action (see
// runBlockAction) but aren't worth a field on every mapped message — resolved
// lazily per bot id instead, and cached since it never changes at runtime.
const botAppInfoCache = new Map<string, Promise<{ appId: string; botUserId: string } | null>>();
function fetchBotAppInfo(botId: string): Promise<{ appId: string; botUserId: string } | null> {
  let cached = botAppInfoCache.get(botId);
  if (!cached) {
    cached = callSlack("bots.info", { bot: botId }).then((data) =>
      data.ok && data.bot?.app_id && data.bot?.user_id
        ? { appId: data.bot.app_id, botUserId: data.bot.user_id }
        : null,
    );
    botAppInfoCache.set(botId, cached);
  }
  return cached;
}

// Dispatches a Block Kit button/overflow-option click. Reverse-engineered from
// a live capture of Slack's own web client: it submits every message action —
// both legacy attachment actions and modern Block Kit block_actions — through
// this one endpoint, translating the block's action_id/block_id into the
// legacy payload's name/callback_id fields. Fire-and-forget, like
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
  style?: string;
  threadTs?: string;
  value?: string;
}): Promise<void> {
  const [botInfo, teamId] = await Promise.all([
    fetchBotAppInfo(params.botId),
    getWorkspaceTeamId(),
  ]);
  if (!botInfo) throw new Error("Couldn't resolve the app behind this button");
  const payload = {
    actions: [
      {
        id: "1",
        name: params.actionId,
        style: params.style ?? "",
        text: params.buttonText,
        type: "button",
        value: params.value ?? "",
      },
    ],
    attachment_id: "1",
    callback_id: params.blockId ?? params.actionId,
    channel_id: params.channelId,
    message_ts: params.messageTs,
    prompt_app_install: false,
    team_id: teamId ?? "",
    // Root ts of the thread the message belongs to — Slack sets this equal
    // to the message's own ts when it isn't a reply.
    thread_ts: params.threadTs ?? params.messageTs,
  };
  const data = await callSlack("chat.attachmentAction", {
    app_id: botInfo.appId,
    bot_user_id: botInfo.botUserId,
    client_token: `web-${Date.now()}`,
    payload: JSON.stringify(payload),
    service_id: params.botId,
  });
  if (!data.ok) throw new Error(data.error ?? "chat.attachmentAction failed");
}
