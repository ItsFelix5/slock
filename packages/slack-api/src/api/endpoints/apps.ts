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

// bots.info's `app_id` is needed to submit a block action (see runBlockAction)
// but isn't worth a field on every mapped message — resolved lazily per bot id
// instead, and cached since it never changes at runtime.
const botAppInfoCache = new Map<string, Promise<{ appId: string } | null>>();
function fetchBotAppInfo(botId: string): Promise<{ appId: string } | null> {
  let cached = botAppInfoCache.get(botId);
  if (!cached) {
    cached = callSlack("bots.info", { bot: botId }).then((data) =>
      data.ok && data.bot?.app_id ? { appId: data.bot.app_id } : null,
    );
    botAppInfoCache.set(botId, cached);
  }
  return cached;
}

// Powers the app "About" flyout Slack's own client shows for a bot user.
// Reverse-engineered from a live capture: apps.profile.get is keyed by the
// app id, the bot's classic id, and the bot's home team (not necessarily this
// workspace's own team id on Enterprise Grid), returning app_profile.desc as
// the short description shown in that flyout. Cached per app id — it never
// changes at runtime, and every bot user of the same app shares one description.
const appDescriptionCache = new Map<string, Promise<string | undefined>>();
export function fetchAppDescription(appId: string, botId: string): Promise<string | undefined> {
  let cached = appDescriptionCache.get(appId);
  if (!cached) {
    cached = getWorkspaceTeamId()
      .then((teamId) =>
        callSlack("apps.profile.get", { app: appId, bot: botId, bot_home_team: teamId ?? "" }),
      )
      .then((data) => (data.ok ? data.app_profile?.desc || undefined : undefined));
    appDescriptionCache.set(appId, cached);
  }
  return cached;
}

// Dispatches a Block Kit button click. Reverse-engineered from a live capture
// of Slack's own web client clicking a real Block Kit button — the fields are
// top-level (not a nested legacy `payload` JSON blob): actions carries the
// modern block_actions shape (action_id/block_id/text/value), and container
// identifies the message the block lives in. Fire-and-forget, like
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
  const [botInfo, teamId] = await Promise.all([
    fetchBotAppInfo(params.botId),
    getWorkspaceTeamId(),
  ]);
  if (!botInfo) throw new Error("Couldn't resolve the app behind this button");
  const data = await callSlack("blocks.actions", {
    actions: JSON.stringify([
      {
        action_id: params.actionId,
        block_id: params.blockId,
        text: { emoji: true, text: params.buttonText, type: "plain_text" },
        type: "button",
        value: params.value ?? "",
      },
    ]),
    app_id: botInfo.appId,
    client_token: `web-${Date.now()}`,
    container: JSON.stringify({
      channel_id: params.channelId,
      is_ephemeral: false,
      message_ts: params.messageTs,
      type: "message",
    }),
    service_id: params.botId,
    service_team_id: teamId ?? "",
    state: JSON.stringify({ values: {} }),
  });
  if (!data.ok) throw new Error(data.error ?? "blocks.actions failed");
}
