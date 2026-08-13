import { apiDelete, apiPut } from "../server";
import { fetchInitialData } from "./initialData";
import { resolveDesktopNotificationsEnabled } from "./preferences/desktopNotifications";

export type UserPrefs = {
  emojiUse: Record<string, number>;
  channelFrecency: Record<string, { count: number; lastVisit: number }>;
  mutedChannels: string[];
  notifyAllChannels: string[];
  channelNotifications: Record<string, { desktop?: string; mobile?: string }>;
  highlightWords: string[];
  desktopNotificationsEnabled: boolean;
  searchHistory: string[];
  channelTabs: Record<string, { type: string }[]>;
  sectionSort: Record<string, "recent">;
  sectionSidebar: Record<string, "hid" | "active" | "all">;

  channelSections: Record<string, Record<string, unknown>>;
  usergroupSectionOrder: string[];
  usergroupSectionSidebar: Record<string, "hid" | "active" | "all">;
  globalNotifications: {
    channelsInActivity: boolean;
    desktop: string;
    desktopPushEnabled: boolean;
    keywords: string[];
    mobileSound?: string;
    mpdmDesktop: string;
    noTextInNotifications: boolean;
    pushIdleWait: number;
    pushShowPreview: boolean;
    threadsEverything: boolean;
  };
};

export async function fetchUserPrefs(): Promise<UserPrefs> {
  const data = await fetchInitialData();
  if (data.error?.notification_prefs) throw new Error(data.error.notification_prefs);
  const prefs = data;
  const parse = (key: string) => {
    try {
      const raw = prefs[key];
      return typeof raw === "string" ? JSON.parse(raw) : (raw ?? null);
    } catch {
      return null;
    }
  };

  const emojiUse: Record<string, number> = parse("emoji_use") ?? {};

  const jumper =
    parse("frecency_ent_jumper") ?? parse("frecency_jumper") ?? parse("frecency") ?? {};
  const channelFrecency: Record<string, { count: number; lastVisit: number }> = {};
  for (const entry of Object.values<any>(jumper)) {
    const id = entry?.id;
    const count = entry?.count ?? 0;
    const lastVisit = Array.isArray(entry?.visits) ? Math.max(...entry.visits) : 0;
    if (!id) continue;
    const existing = channelFrecency[id];
    if (!existing || count > existing.count) channelFrecency[id] = { count, lastVisit };
  }

  const mutedChannelsList: string[] = (prefs.muted_channels ?? "")
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean);

  const allNotifications = parse("notification_prefs") ?? {};
  const notificationGlobal = allNotifications.global ?? {};
  const notificationOverrides = allNotifications.channels ?? {};

  const mutedChannels = Array.from(
    new Set([
      ...mutedChannelsList,
      ...Object.keys(notificationOverrides).filter((id) => notificationOverrides[id]?.muted),
    ]),
  );
  const hasGlobalKeywords = typeof notificationGlobal.global_keywords === "string";
  const globalKeywords = hasGlobalKeywords
    ? notificationGlobal.global_keywords
        .split(",")
        .map((word: string) => word.trim())
        .filter(Boolean)
    : [];

  const hasHighlightWords = typeof prefs.highlight_words === "string";
  const highlightWords: string[] = hasHighlightWords
    ? prefs.highlight_words
        .split(",")
        .map((word: string) => word.trim())
        .filter(Boolean)
    : globalKeywords;
  const globalNotifications = {
    channelsInActivity: notificationGlobal.global_channels_in_activity !== false,
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
  for (const [id, override] of Object.entries<any>(notificationOverrides)) {
    const desktop = typeof override?.desktop === "string" ? override.desktop : undefined;
    const mobile = typeof override?.mobile === "string" ? override.mobile : undefined;
    if (desktop || mobile) channelNotifications[id] = { desktop, mobile };
  }

  const desktopNotificationsEnabled = resolveDesktopNotificationsEnabled(
    prefs.slock_desktop_notifications,
    globalNotifications.desktopPushEnabled,
  );
  const parsedSearchHistory = parse("slock_search_history");
  const searchHistory: string[] = Array.isArray(parsedSearchHistory) ? parsedSearchHistory : [];
  const parsedChannelTabs = parse("slock_channel_tabs");
  const channelTabs: Record<string, { type: string }[]> =
    parsedChannelTabs && typeof parsedChannelTabs === "object" ? parsedChannelTabs : {};

  const parsedSectionPrefs = parse("channel_sections") ?? {};
  const sectionSort: Record<string, "recent"> = {};
  const sectionSidebar: Record<string, "hid" | "active" | "all"> = {};
  const channelSections: Record<string, Record<string, unknown>> = {};
  if (parsedSectionPrefs && typeof parsedSectionPrefs === "object") {
    for (const [id, value] of Object.entries<any>(parsedSectionPrefs)) {
      if (value && typeof value === "object") channelSections[id] = { ...value };
      if (value?.sort === "recent") sectionSort[id] = "recent";
      if (value?.sidebar === "hid" || value?.sidebar === "active" || value?.sidebar === "all")
        sectionSidebar[id] = value.sidebar;
    }
  }
  const parsedUsergroupSectionSidebar = parse("slock_usergroup_section_sidebar") ?? {};
  const usergroupSectionSidebar: Record<string, "hid" | "active" | "all"> = {};
  if (parsedUsergroupSectionSidebar && typeof parsedUsergroupSectionSidebar === "object") {
    for (const [id, value] of Object.entries(parsedUsergroupSectionSidebar)) {
      if (value === "hid" || value === "active" || value === "all")
        usergroupSectionSidebar[id] = value;
    }
  }
  const parsedUsergroupSectionOrder = parse("slock_usergroup_section_order");
  const usergroupSectionOrder: string[] = Array.isArray(parsedUsergroupSectionOrder)
    ? parsedUsergroupSectionOrder.filter((id): id is string => typeof id === "string")
    : [];

  return {
    channelFrecency,
    channelNotifications,
    channelTabs,
    desktopNotificationsEnabled,
    emojiUse,
    globalNotifications,
    highlightWords,
    mutedChannels,
    notifyAllChannels,
    searchHistory,
    sectionSort,
    sectionSidebar,
    channelSections,
    usergroupSectionOrder,
    usergroupSectionSidebar,
  };
}

export async function setChannelSectionsPreference(
  sections: Record<string, Record<string, unknown>>,
): Promise<boolean> {
  const data = await apiPut("/api/preferences/channel-sections", { sections });
  return !!data.ok;
}

export async function setUsergroupSectionOrderPreference(sectionIds: string[]): Promise<boolean> {
  const data = await apiPut("/api/preferences/usergroup-section-order", {
    sectionIds,
  });
  return !!data.ok;
}

export async function setUsergroupSectionSidebarPreferences(
  entries: Record<string, "hid" | "active" | "all">,
): Promise<boolean> {
  const data = await apiPut("/api/preferences/usergroup-section-sidebar", {
    entries,
  });
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

export async function setDesktopNotificationsEnabled(enabled: boolean): Promise<void> {
  const data = await apiPut("/api/preferences/desktop-notifications", {
    enabled,
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setSearchHistory(queries: string[]): Promise<void> {
  const data = await apiPut("/api/preferences/search-history", { queries });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setChannelTabs(entries: Record<string, { type: string }[]>): Promise<void> {
  const data = await apiPut("/api/preferences/channel-tabs", { entries });
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
