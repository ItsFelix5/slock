import type { UserPrefs } from "@slock/types";
import { ApiError, apiDelete, apiPut } from "@slock/types";
import { fetchInitialData } from "./initialData";

type FrecencyEntry = { count?: number; id?: string; visits?: number[] };
type NotificationOverride = { desktop?: string; mobile?: string; muted?: boolean };
type NotificationPrefs = {
  channels?: Record<string, NotificationOverride>;
  global?: {
    global_desktop?: string;
    global_desktop_push_enabled?: boolean;
    global_keywords?: string;
    global_mpdm_desktop?: string;
    mobile_sound?: string;
    no_text_in_notifications?: boolean;
    push_idle_wait?: number | string;
    push_show_preview?: boolean;
    threads_everything?: boolean;
  };
};
type SectionPref = { collapsed?: boolean; sidebar?: string; sort?: string };

function parsePref<T>(raw: string | undefined): T | null {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function fetchUserPrefs(): Promise<UserPrefs> {
  const data = await fetchInitialData();
  if (data.error?.notification_prefs) {
    throw new ApiError(data.error.notification_prefs, data.retry_after?.notification_prefs);
  }
  const emojiUse = parsePref<Record<string, number>>(data.emoji_use) ?? {};

  const jumper =
    parsePref<Record<string, FrecencyEntry>>(data.frecency_ent_jumper) ??
    parsePref<Record<string, FrecencyEntry>>(data.frecency_jumper) ??
    parsePref<Record<string, FrecencyEntry>>(data.frecency) ??
    {};
  const channelFrecency: Record<string, { count: number; lastVisit: number }> = {};
  for (const entry of Object.values(jumper)) {
    const { id } = entry;
    const count = entry.count ?? 0;
    const lastVisit = entry.visits ? Math.max(...entry.visits) : 0;
    if (!id) continue;
    const existing = channelFrecency[id];
    if (!existing || count > existing.count) channelFrecency[id] = { count, lastVisit };
  }

  const mutedChannelsList = (data.muted_channels ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const allNotifications = parsePref<NotificationPrefs>(data.notification_prefs) ?? {};
  const notificationGlobal = allNotifications.global ?? {};
  const notificationOverrides = allNotifications.channels ?? {};

  const mutedChannels = Array.from(
    new Set([
      ...mutedChannelsList,
      ...Object.keys(notificationOverrides).filter((id) => notificationOverrides[id]?.muted),
    ]),
  );
  const globalKeywords = (notificationGlobal.global_keywords ?? "")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);

  const highlightWords = globalKeywords;
  const globalNotifications = {
    desktop: notificationGlobal.global_desktop ?? "mentions_dms",
    desktopPushEnabled: notificationGlobal.global_desktop_push_enabled !== false,
    keywords: globalKeywords,
    mobileSound: notificationGlobal.mobile_sound,
    mpdmDesktop: notificationGlobal.global_mpdm_desktop ?? "mentions_dms",
    noTextInNotifications: !!notificationGlobal.no_text_in_notifications,
    pushIdleWait: Number(notificationGlobal.push_idle_wait) || 0,
    pushShowPreview: notificationGlobal.push_show_preview !== false,
    threadsEverything: !!notificationGlobal.threads_everything,
  };
  const notifyAllChannels = Object.keys(notificationOverrides).filter(
    (id) =>
      notificationOverrides[id]?.desktop === "everything" ||
      notificationOverrides[id]?.mobile === "everything",
  );
  const channelNotifications: UserPrefs["channelNotifications"] = {};
  for (const [id, { desktop, mobile }] of Object.entries(notificationOverrides)) {
    if (desktop || mobile) channelNotifications[id] = { desktop, mobile };
  }

  const parsedSectionPrefs = parsePref<Record<string, SectionPref | null>>(data.channel_sections);
  const sectionSort: Record<string, "recent"> = {};
  const sectionSidebar: Record<string, "hid" | "active" | "all"> = {};
  const sectionCollapsed: Record<string, boolean> = {};
  const channelSections: Record<string, Record<string, unknown>> = {};
  for (const [id, value] of Object.entries(parsedSectionPrefs ?? {})) {
    if (!value) continue;
    channelSections[id] = { ...value };
    if (value.sort === "recent") sectionSort[id] = "recent";
    if (value.sidebar === "hid" || value.sidebar === "active" || value.sidebar === "all")
      sectionSidebar[id] = value.sidebar;
    if (typeof value.collapsed === "boolean") sectionCollapsed[id] = value.collapsed;
  }
  return {
    channelFrecency,
    channelNotifications,
    emojiUse,
    globalNotifications,
    highlightWords,
    mutedChannels,
    notifyAllChannels,
    sectionSort,
    sectionSidebar,
    sectionCollapsed,
    channelSections,
  };
}

export async function setChannelSectionsPreference(
  sections: Record<string, Record<string, unknown>>,
): Promise<boolean> {
  const data = await apiPut("/api/preferences/channel-sections", { sections });
  return !!data.ok;
}

export async function setMutedChannels(channelIds: string[]): Promise<void> {
  const data = await apiPut("/api/preferences/muted-channels", { channelIds });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setHighlightWords(words: string[]): Promise<void> {
  const data = await apiPut("/api/preferences/highlight-words", { words });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function fetchDndStatus(): Promise<number | null> {
  const data = await fetchInitialData();
  if (data.error?.snooze) throw new Error(data.error.snooze);
  return data.snooze?.endtime ? data.snooze.endtime * 1000 : null;
}

export async function setDndSnooze(minutes: number): Promise<void> {
  const data = await apiPut("/api/dnd/snooze", { minutes });
  if (!data.ok) throw new Error(data.error ?? "dnd.setSnooze failed");
}

export async function endDndSnooze(): Promise<void> {
  const data = await apiDelete("/api/dnd/snooze");
  if (!data.ok) throw new Error(data.error ?? "dnd.endSnooze failed");
}
