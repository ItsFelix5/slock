import type { UserPrefs } from "@slock/types";
import { apiDelete, apiPut } from "@slock/types";
import { fetchInitialData } from "./initialData";

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
  const parsedThemeColors = parse("slock_theme_colors");
  const themeColors: UserPrefs["themeColors"] =
    parsedThemeColors &&
    typeof parsedThemeColors === "object" &&
    parsedThemeColors.colors &&
    (parsedThemeColors.colorScheme === "dark" || parsedThemeColors.colorScheme === "light")
      ? { colors: parsedThemeColors.colors, colorScheme: parsedThemeColors.colorScheme }
      : undefined;

  const parsedThemeShape = parse("slock_theme_shape");
  const themeShape: UserPrefs["themeShape"] =
    parsedThemeShape &&
    typeof parsedThemeShape.density === "number" &&
    typeof parsedThemeShape.roundness === "number"
      ? { density: parsedThemeShape.density, roundness: parsedThemeShape.roundness }
      : undefined;

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
    channelSections,
    themeColors,
    themeShape,
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

export async function setThemeColorsPref(theme: {
  colors: Record<string, string>;
  colorScheme: "dark" | "light";
}): Promise<void> {
  const data = await apiPut("/api/preferences/theme-colors", theme);
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setThemeShapePref(shape: {
  density: number;
  roundness: number;
}): Promise<void> {
  const data = await apiPut("/api/preferences/theme-shape", shape);
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
