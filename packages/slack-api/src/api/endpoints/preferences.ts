import { callSlack } from "../relay";

export type UserPrefs = {
  emojiUse: Record<string, number>;
  channelFrecency: Record<string, { count: number; lastVisit: number }>;
  mutedChannels: string[];
  notifyAllChannels: string[];
  highlightWords: string[];
  desktopNotificationsEnabled: boolean;
  searchHistory: string[];
  channelTabs: Record<string, { type: string }[]>;
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
  const empty: UserPrefs = {
    channelFrecency: {},
    channelTabs: {},
    desktopNotificationsEnabled: true,
    emojiUse: {},
    highlightWords: [],
    mutedChannels: [],
    notifyAllChannels: [],
    searchHistory: [],
    globalNotifications: {
      channelsInActivity: true,
      desktop: "mentions_dms",
      desktopPushEnabled: true,
      keywords: [],
      mpdmDesktop: "mentions_dms",
      noTextInNotifications: false,
      pushIdleWait: 0,
      pushShowPreview: true,
      threadsEverything: false,
    },
  };
  const data = await callSlack("users.prefs.get");
  if (!data.ok) return empty;
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

  const mutedChannels: string[] = (prefs.muted_channels ?? "")
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean);

  const allNotifications = parse("all_notifications_prefs") ?? {};
  const notificationGlobal = allNotifications.global ?? {};
  const notificationOverrides = allNotifications.channels ?? {};
  const hasGlobalKeywords = typeof notificationGlobal.global_keywords === "string";
  const globalKeywords = hasGlobalKeywords
    ? notificationGlobal.global_keywords
        .split(",")
        .map((word: string) => word.trim())
        .filter(Boolean)
    : [];
  // `global_keywords` is Slack's canonical pingword setting. Retain the
  // previous key only as a fallback for old or incomplete pref payloads.
  const highlightWords: string[] = hasGlobalKeywords
    ? globalKeywords
    : (prefs.highlight_words ?? "")
        .split(",")
        .map((word: string) => word.trim())
        .filter(Boolean);
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

  const desktopNotificationsEnabled = globalNotifications.desktopPushEnabled;
  const parsedSearchHistory = parse("slock_search_history");
  const searchHistory: string[] = Array.isArray(parsedSearchHistory) ? parsedSearchHistory : [];
  const parsedChannelTabs = parse("slock_channel_tabs");
  const channelTabs: Record<string, { type: string }[]> =
    parsedChannelTabs && typeof parsedChannelTabs === "object" ? parsedChannelTabs : {};

  return {
    channelFrecency,
    channelTabs,
    desktopNotificationsEnabled,
    emojiUse,
    globalNotifications,
    highlightWords,
    mutedChannels,
    notifyAllChannels,
    searchHistory,
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
  const data = await callSlack("users.prefs.setNotifications", {
    global: "true",
    name: "keywords",
    value: words.join(","),
  });
  if (!data.ok) throw new Error(data.error ?? "users.prefs.setNotifications failed");
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
  const data = await callSlack("dnd.info");
  if (!(data.ok && data.snooze_enabled && data.snooze_endtime)) return null;
  return data.snooze_endtime * 1000;
}

export async function setDndSnooze(minutes: number): Promise<void> {
  const data = await callSlack("dnd.setSnooze", { num_minutes: String(minutes) });
  if (!data.ok) throw new Error(data.error ?? "dnd.setSnooze failed");
}

export async function endDndSnooze(): Promise<void> {
  const data = await callSlack("dnd.endSnooze");
  if (!data.ok) throw new Error(data.error ?? "dnd.endSnooze failed");
}

// The account's real per-conversation read cursors (client.counts), used to tell
// whether an activity/mention item has actually been read rather than tracking
// a single locally-invented "activity read at" timestamp.
export async function fetchLastReadByChannel(): Promise<Record<string, number>> {
  const data = await callSlack("client.counts");
  const lastReadByChannel: Record<string, number> = {};
  if (!data.ok) return lastReadByChannel;
  for (const list of [data.channels, data.ims, data.mpims]) {
    for (const c of list ?? []) {
      const ts = parseFloat(c.last_read);
      if (ts) lastReadByChannel[c.id] = ts * 1000;
    }
  }
  return lastReadByChannel;
}
