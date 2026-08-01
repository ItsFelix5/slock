import { callSlack } from "../relay";
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

// users.prefs.get carries the account's *real* local-usage databases (each pref
// value is itself a JSON string the client must parse) — emoji_use is a flat
// name->count map, while frecency_ent_jumper (Enterprise Grid) / frecency_jumper
// (non-EG) is the quick-switcher's jump list: one entry per canonical id plus a
// bunch of alias entries that share that same id, so entries are reduced down to
// one {count, lastVisit} per id. muted_channels is a plain comma-separated id
// list; all_notifications_prefs is a JSON blob shaped
// `{channels: {id: {desktop?, mobile?}}, global: {...}}` where a channel override
// value of "everything" means "notify me about all messages". Its `global`
// object also contains all account-wide notification settings, including
// `global_keywords`: the comma-separated custom keywords ("pingwords") that
// ping you like an @mention whenever they appear in a message.
// slock_desktop_notifications, slock_search_history and slock_channel_tabs are
// app-invented keys (the prefs blob is a generic KV store, not limited to
// Slack's own known keys) — used to sync purely client-side app settings
// across devices the same real way rather than falling back to localStorage
// for them. slock_channel_tabs in particular backs this app's own editable
// per-channel tab bar (Canvas/Pinned shortcuts under the channel header) —
// unrelated to Slack's real, admin-only, unwritable `properties.tabs`.
export async function fetchUserPrefs(): Promise<UserPrefs> {
  const data = (await fetchInitialData()).prefs;
  if (!data.ok) throw new Error(data.error ?? "users.prefs.get failed");
  const prefs = data.prefs ?? {};
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

  const allNotifications = parse("all_notifications_prefs") ?? {};
  const notificationGlobal = allNotifications.global ?? {};
  const notificationOverrides = allNotifications.channels ?? {};
  // The real client actually mutes a channel through this per-channel
  // `muted` flag, not the legacy muted_channels list — merge both so a
  // channel muted either way reads back as muted.
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
  // `users.prefs.setNotifications` rejects keyword changes for some Slack
  // sessions/workspaces. Keep Slock's list in the ordinary prefs blob, whose
  // read and write APIs work consistently, while still importing Slack's
  // canonical global list when no Slock list has been saved yet.
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

  // Per-section sidebar settings, keyed by channel_section_id. This blob is
  // the real source of truth for both a section's filter (`sidebar`: "hid"
  // unread-only / "active" / "all") and its `sort: "recent"` ordering —
  // users.channelSections.list doesn't reliably carry either.
  const parsedSectionPrefs = parse("channel_sections") ?? {};
  const sectionSort: Record<string, "recent"> = {};
  const sectionSidebar: Record<string, "hid" | "active" | "all"> = {};
  if (parsedSectionPrefs && typeof parsedSectionPrefs === "object") {
    for (const [id, value] of Object.entries<any>(parsedSectionPrefs)) {
      if (value?.sort === "recent") sectionSort[id] = "recent";
      if (value?.sidebar === "hid" || value?.sidebar === "active" || value?.sidebar === "all")
        sectionSidebar[id] = value.sidebar;
    }
  }

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
  };
}

// This uses the same "prefs blob" mechanism the real webapp saves all of its
// local settings through, not a documented api.slack.com method.
export async function setMutedChannels(channelIds: string[]): Promise<void> {
  const data = await callSlack("users.prefs.set", {
    name: "muted_channels",
    value: channelIds.join(","),
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setHighlightWords(words: string[]): Promise<void> {
  const data = await callSlack("users.prefs.set", {
    name: "highlight_words",
    value: words.join(","),
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setDesktopNotificationsEnabled(enabled: boolean): Promise<void> {
  const data = await callSlack("users.prefs.set", {
    name: "slock_desktop_notifications",
    value: enabled ? "on" : "off",
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setSearchHistory(queries: string[]): Promise<void> {
  const data = await callSlack("users.prefs.set", {
    name: "slock_search_history",
    value: JSON.stringify(queries),
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

export async function setChannelTabs(entries: Record<string, { type: string }[]>): Promise<void> {
  const data = await callSlack("users.prefs.set", {
    name: "slock_channel_tabs",
    value: JSON.stringify(entries),
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.set failed");
}

// dnd.info is a documented public method — the account's real snooze deadline.
export async function fetchDndStatus(): Promise<number | null> {
  const data = (await fetchInitialData()).dnd;
  if (!data.ok) throw new Error(data.error ?? "dnd.info failed");
  if (!(data.snooze_enabled && data.snooze_endtime)) return null;
  return data.snooze_endtime * 1000;
}

export async function setDndSnooze(minutes: number): Promise<void> {
  // biome-ignore lint/style/useNamingConvention: Slack expects the documented wire parameter.
  const data = await callSlack("dnd.setSnooze", { num_minutes: String(minutes) });
  if (!data.ok) throw new Error(data.error ?? "dnd.setSnooze failed");
}

export async function endDndSnooze(): Promise<void> {
  const data = await callSlack("dnd.endSnooze");
  if (!data.ok) throw new Error(data.error ?? "dnd.endSnooze failed");
}
