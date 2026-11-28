import { appProfile } from "@slock/plugins/slack/client/api/apps";
import { replyError } from "@slock/slack";
import { apiGet, apiPost } from "@slock/slack/client";
import type { ChannelId, ModalView, UserId } from "@slock/types";

type AppHome = {
  appHome: {
    app_id: string;
    home_tab_enabled: boolean;
    messages_tab_enabled: boolean;
  } | null;
  view: ModalView | null;
};

export async function fetchAppHome(channelId: ChannelId, signal: AbortSignal): Promise<AppHome> {
  const data = await apiGet<AppHome>(`/api/conversations/${channelId}/app-home`, signal);
  if (!data.ok) throw replyError(data, "app home lookup failed");
  return { appHome: data.appHome, view: data.view ?? null };
}

export async function dispatchHomeOpen(channelId: ChannelId, appId: string): Promise<void> {
  const data = await apiPost(`/api/conversations/${channelId}/app-home/open`, { appId });
  if (!data.ok) throw replyError(data, "app home open failed");
}

export async function fetchAppUserId(appId: string): Promise<UserId> {
  const { userId } = await appProfile.ensure({ appId });
  if (!userId) throw new Error("app has no user");
  return userId;
}
