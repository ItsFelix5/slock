import type { MessageShortcut } from "../types";
import { callSlack, fileProxyUrl } from "./relay";

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
