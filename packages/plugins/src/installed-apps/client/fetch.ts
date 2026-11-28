import { defineQuery } from "@slock/plugins/query/client/api";
import { isChannelId, isUserId, replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { ChannelId, UserId } from "@slock/types";

type InstalledApp = { id: string; name: string; icon?: string; official: boolean };

type AppInstallers = { userIds: UserId[]; channelIds: ChannelId[]; hiddenChannels: number };

type RawInstallers = { userIds: string[]; channelIds: string[]; hiddenChannels: number };

async function fetchInstalledApps(userId: UserId, signal: AbortSignal): Promise<InstalledApp[]> {
  const data = await apiGet<{ apps: InstalledApp[] }>(
    `/api/users/${userId}/installed-apps`,
    signal,
  );
  if (!data.ok) throw replyError(data, "installed apps lookup failed");
  return data.apps;
}

async function fetchAppInstallers(appId: string, signal: AbortSignal): Promise<AppInstallers> {
  const data = await apiGet<RawInstallers>(`/api/apps/${appId}/installers`, signal);
  if (!data.ok) throw replyError(data, "app installers lookup failed");
  return {
    channelIds: data.channelIds.filter(isChannelId),
    hiddenChannels: data.hiddenChannels,
    userIds: data.userIds.filter(isUserId),
  };
}

export const installedApps = defineQuery<UserId, InstalledApp[]>({
  load: (userId, { signal }) => fetchInstalledApps(userId, signal),
  name: "installedApps",
});

export const appInstallers = defineQuery<string, AppInstallers>({
  load: (appId, { signal }) => fetchAppInstallers(appId, signal),
  name: "appInstallers",
});
