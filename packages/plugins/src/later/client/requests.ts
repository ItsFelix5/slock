import { replyError } from "@slock/slack";
import { apiDelete, apiGet, apiPatch, apiPost } from "@slock/slack/client";
import type { ChannelId, SavedItem, Ts } from "@slock/types";

export async function fetchSaved(signal?: AbortSignal): Promise<SavedItem[]> {
  const data = await apiGet<{ items?: SavedItem[] }>("/api/saved", signal);
  if (!data.ok) throw replyError(data, "saved.list failed");
  return data.items ?? [];
}

export async function toggleSaved(channelId: ChannelId, ts: Ts, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/save`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw replyError(data, "saved.add/remove failed");
  return data;
}

export async function saveWithReminder(channelId: ChannelId, ts: Ts, dateDue: number) {
  const data = await apiPost(`/api/messages/${channelId}/${ts}/reminder`, { dateDue });
  if (!data.ok) throw replyError(data, "saved.add failed");
  return data;
}

export async function updateSaved(channelId: ChannelId, ts: Ts, change: { dateDue: number }) {
  const data = await apiPatch(`/api/messages/${channelId}/${ts}/save`, change);
  if (!data.ok) throw replyError(data, "saved.update failed");
  return data;
}
