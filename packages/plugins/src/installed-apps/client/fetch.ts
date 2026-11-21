import { defineQuery } from "@slock/plugins/query/client/api";
import { apiGet, isChannelId, isUserId } from "@slock/slack";
import type { ChannelId, UserId } from "@slock/types";

export type InstalledApp = { id: string; name: string; icon?: string; official: boolean };

export type AppInstallers = { userIds: UserId[]; channelIds: ChannelId[]; hiddenChannels: number };

type RawInstallers = { userIds: string[]; channelIds: string[]; hiddenChannels: number };

async function fetchInstalledApps(userId: UserId): Promise<InstalledApp[]> {
  const data = await apiGet<{ apps: InstalledApp[] }>(`/api/users/${userId}/installed-apps`);
  if (!data.ok) throw new Error(data.error ?? "installed apps lookup failed");
  return data.apps;
}

export async function fetchAppInstallers(appId: string): Promise<AppInstallers> {
  const data = await apiGet<RawInstallers>(`/api/apps/${appId}/installers`);
  if (!data.ok) throw new Error(data.error ?? "app installers lookup failed");
  return {
    channelIds: data.channelIds.filter(isChannelId),
    hiddenChannels: data.hiddenChannels,
    userIds: data.userIds.filter(isUserId),
  };
}

export const installedApps = defineQuery<UserId, InstalledApp[]>({
  load: fetchInstalledApps,
  name: "installedApps",
});

export const appInstallers = defineQuery<string, AppInstallers>({
  load: fetchAppInstallers,
  name: "appInstallers",
});
