import type { ProfileFieldDef, User } from "../types";
import { mapUser } from "./mappers";
import { callSlack, callSlackEdge } from "./relay";

export async function fetchUser(id: string): Promise<User | null> {
  // The normal Web API users.info endpoint is restricted on Enterprise Grid.
  // The cache endpoint accepts the ids it should refresh as a timestamp map;
  // zero deliberately requests the complete current record.
  const data = await callSlackEdge("users/info", {
    include_profile_only_users: true,
    updated_ids: { [id]: 0 },
  });
  if (!data.ok) return null;
  // Cache responses have appeared as both an id-keyed `users` object and a
  // result array. Retain `user` as a fallback for compatible relay responses.
  const raw =
    data.users?.[id] ??
    data.results?.find((user: any) => user.id === id) ??
    data.users?.find?.((user: any) => user.id === id) ??
    data.user;
  return raw ? mapUser(raw) : null;
}

// team.profile.get's field *definitions* (label/ordering) are workspace-wide and
// separate from each user's field *values* (see mapUser's customFields) — fetched
// once and joined against a user's values at render time. Some workspaces restrict
// this to admins, so a failure degrades to "no custom fields shown".
export async function fetchProfileFieldDefs(): Promise<ProfileFieldDef[]> {
  try {
    const data = await callSlack("team.profile.get");
    if (!data.ok) return [];
    const fields: any[] = data.profile?.fields ?? [];
    return fields
      .filter((f) => !f.is_hidden)
      .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
      .map((f) => ({ id: f.id, label: f.label }));
  } catch {
    return [];
  }
}

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

export async function setStatus(text: string, emoji: string, expiration: number): Promise<void> {
  const profile = JSON.stringify({
    status_emoji: emoji,
    status_expiration: expiration,
    status_text: text,
  });
  const data = await callSlack("users.profile.set", { profile });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setProfileFields(fields: {
  displayName?: string;
  title?: string;
  pronouns?: string;
  customFields?: Record<string, string>;
}): Promise<void> {
  const profile: Record<string, unknown> = {};
  if (fields.displayName !== undefined) profile.display_name = fields.displayName;
  if (fields.title !== undefined) profile.title = fields.title;
  if (fields.pronouns !== undefined) profile.pronouns = fields.pronouns;
  if (fields.customFields) {
    profile.fields = Object.fromEntries(
      Object.entries(fields.customFields).map(([id, value]) => [id, { alt: "", value }]),
    );
  }
  const data = await callSlack("users.profile.set", { profile: JSON.stringify(profile) });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await callSlack("users.setPresence", { presence });
  if (!data.ok) throw new Error(data.error ?? "users.setPresence failed");
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

export type DraftEntry = { channelId: string; threadTs?: string; text: string };

// Tracks the real Slack draft id + client_msg_id behind each channel/thread's
// live composer draft, so repeated saves update the same draft.create row
// instead of creating a new one on every debounce tick.
const draftState = new Map<string, { draftId: string; clientMsgId: string }>();
function draftKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:${threadTs}` : channelId;
}

export async function fetchDrafts(): Promise<DraftEntry[]> {
  const data = await callSlack("drafts.list", { is_active: "true", limit: "100" });
  if (data.ok === false) return [];
  const drafts: any[] = data.drafts ?? [];
  return drafts.map((d) => {
    const dest = d.destinations?.[0] ?? {};
    draftState.set(draftKey(dest.channel_id, dest.thread_ts), {
      clientMsgId: d.client_msg_id,
      draftId: d.id,
    });
    return {
      channelId: dest.channel_id,
      text: d.blocks?.[0]?.text?.text ?? "",
      threadTs: dest.thread_ts,
    };
  });
}

export async function saveDraft(channelId: string, threadTs: string | undefined, text: string) {
  const key = draftKey(channelId, threadTs);
  const existing = draftState.get(key);

  if (!text.trim()) {
    if (existing) {
      await callSlack("drafts.delete", {
        client_last_updated_ts: String(Date.now() / 1000),
        draft_id: existing.draftId,
      });
      draftState.delete(key);
    }
    return;
  }

  const clientMsgId = existing?.clientMsgId ?? crypto.randomUUID();
  const destination: Record<string, string> = { channel_id: channelId };
  if (threadTs) destination.thread_ts = threadTs;
  const params: Record<string, string> = {
    blocks: JSON.stringify([{ text: { text, type: "mrkdwn" }, type: "section" }]),
    client_msg_id: clientMsgId,
    destinations: JSON.stringify([destination]),
    file_ids: "[]",
    is_from_composer: "true",
  };
  if (existing) params.draft_id = existing.draftId;
  const data = await callSlack("drafts.create", params);
  const draftId = data.draft?.id ?? data.id;
  if (data.ok !== false && draftId) draftState.set(key, { clientMsgId, draftId });
}
