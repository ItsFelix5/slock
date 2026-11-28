import { parseChannelId, replyError, slackErrorOf } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { BootstrapPayload, UserPrefs } from "@slock/types";
import { fetchInitialDataWith } from "./initialData";

type FrecencyEntry = { count: number; id: string; lastVisit: number };
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

export function fetchPrefsPayload(signal?: AbortSignal): Promise<BootstrapPayload> {
  return fetchInitialDataWith("notification_prefs", async () => {
    const data = await apiGet<BootstrapPayload>("/api/bootstrap/notification_prefs", signal);
    if (!data.ok) throw replyError(data, "users.prefs.get failed");
    return data;
  });
}

export function mapUserPrefs(data: BootstrapPayload): UserPrefs {
  if (data.error?.notification_prefs) {
    throw slackErrorOf({
      code: data.error.notification_prefs,
      fallback: "users.prefs.get failed",
      retryAfter: data.retry_after?.notification_prefs,
    });
  }
  const emojiUse = parsePref<Record<string, number>>(data.emoji_use) ?? {};

  const channelFrecency: UserPrefs["channelFrecency"] = {};
  for (const { count, id, lastVisit } of Object.values(
    parsePref<Record<string, FrecencyEntry>>(data.frecency) ?? {},
  )) {
    channelFrecency[parseChannelId(id)] = { count, lastVisit };
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
  ).map(parseChannelId);
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
  const notifyAllChannels = Object.keys(notificationOverrides)
    .filter(
      (id) =>
        notificationOverrides[id]?.desktop === "everything" ||
        notificationOverrides[id]?.mobile === "everything",
    )
    .map(parseChannelId);
  const channelNotifications: UserPrefs["channelNotifications"] = {};
  for (const [id, { desktop, mobile }] of Object.entries(notificationOverrides)) {
    if (desktop || mobile) channelNotifications[parseChannelId(id)] = { desktop, mobile };
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
