import { replyError } from "@slock/slack";
import { apiDelete, apiGet, apiPut } from "@slock/slack/client";
import type { ChannelId } from "@slock/types";
import { type PairedPreferenceValues, writePairedPreference } from "./pairedPreferenceWrite";

export const notifyValue = (notifyAll: boolean) => (notifyAll ? "everything" : "mentions_dms");

export async function setChannelNotifyAll(
  channelId: ChannelId,
  notifyAll: boolean,
  previous: { desktop?: string; mobile?: string } = {},
): Promise<void> {
  const value = notifyValue(notifyAll);
  const fallbackPrevious = notifyValue(!notifyAll);
  const previousValues: PairedPreferenceValues = {
    desktop: previous.desktop ?? fallbackPrevious,
    mobile: previous.mobile ?? fallbackPrevious,
  };
  await writePairedPreference(value, previousValues, async (target, targetValue) => {
    const result = await apiPut(`/api/channels/${channelId}/notifications`, {
      target,
      value: targetValue,
    });
    return !!result.ok;
  });
}

export async function setMutedChannels(channelIds: ChannelId[]): Promise<void> {
  const data = await apiPut("/api/preferences/muted-channels", { channelIds });
  if (!data.ok) throw replyError(data, "users.prefs.set failed");
}

export async function setHighlightWords(words: string[]): Promise<void> {
  const data = await apiPut("/api/preferences/highlight-words", { words });
  if (!data.ok) throw replyError(data, "users.prefs.set failed");
}

export async function fetchDndStatus(signal: AbortSignal): Promise<number | null> {
  const data = await apiGet<{ endtime: number | null }>("/api/dnd/snooze", signal);
  if (!data.ok) throw replyError(data, "dnd.info failed");
  return data.endtime ? data.endtime * 1000 : null;
}

export async function setDndSnooze(minutes: number): Promise<void> {
  const data = await apiPut("/api/dnd/snooze", { minutes });
  if (!data.ok) throw replyError(data, "dnd.setSnooze failed");
}

export async function endDndSnooze(): Promise<void> {
  const data = await apiDelete("/api/dnd/snooze");
  if (!data.ok) throw replyError(data, "dnd.endSnooze failed");
}
