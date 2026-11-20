import { apiGet, apiPost } from "@slock/slack";
import type { ChannelId, ModalView } from "@slock/types";

export type AppHome = {
  appHome: {
    app_id: string;
    home_tab_enabled: boolean;
    messages_tab_enabled: boolean;
  } | null;
  view: ModalView | null;
};

export async function fetchAppHome(channelId: ChannelId): Promise<AppHome> {
  const data = await apiGet<AppHome>(`/api/conversations/${channelId}/app-home`);
  if (!data.ok) throw new Error(data.error ?? "app home lookup failed");
  return { appHome: data.appHome, view: data.view ?? null };
}

export async function dispatchHomeOpen(channelId: ChannelId, appId: string): Promise<void> {
  const data = await apiPost(`/api/conversations/${channelId}/app-home/open`, { appId });
  if (!data.ok) throw new Error(data.error ?? "app home open failed");
}
