// biome-ignore-all lint/style/useNamingConvention lint/style/noExcessiveLinesPerFile: Read payload trimmers share the same recursive entity helpers.
import { trimChannel, trimUser } from "./slackEntities.ts";

function trimUserBoot(data: any): any {
  const trimIm = (im: any) => ({
    created: im?.created,
    id: im?.id,
    is_open: im?.is_open,
    updated: im?.updated,
    user: im?.user,
  });
  const trimMpim = (group: any) => ({
    created: group?.created,
    id: group?.id,
    is_open: group?.is_open,
    members: group?.members,
    updated: group?.updated,
  });
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimChannel) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimIm) : data.ims,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimMpim) : data.mpims,
    ok: true,
    self: trimUser(data.self),
    starred: Array.isArray(data.starred)
      ? data.starred.map((star: any) =>
          typeof star === "string" ? star : { channel: star?.channel, id: star?.id },
        )
      : data.starred,
    subteams: Array.isArray(data.subteams?.self) ? { self: data.subteams.self } : undefined,
  };
}

function trimCounts(data: any): any {
  const trimGroup = (group: any) => ({
    has_unreads: group?.has_unreads,
    id: group?.id,
    is_unread: group?.is_unread,
    last_read: group?.last_read,
    latest: group?.latest,
    mention_count: group?.mention_count,
    mention_count_display: group?.mention_count_display,
    unread_count: group?.unread_count,
    unread_count_display: group?.unread_count_display,
  });
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimGroup) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimGroup) : data.ims,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimGroup) : data.mpims,
    ok: true,
  };
}

const USER_PREF_KEYS = [
  "all_notifications_prefs",
  "channel_sections",
  "emoji_use",
  "frecency",
  "frecency_ent_jumper",
  "frecency_jumper",
  "highlight_words",
  "muted_channels",
  "slock_channel_tabs",
  "slock_desktop_notifications",
  "slock_search_history",
] as const;

function trimUserPrefs(data: any): any {
  const prefs = data.prefs ?? {};
  return {
    ok: true,
    prefs: Object.fromEntries(USER_PREF_KEYS.map((key) => [key, prefs[key]])),
  };
}

export function trimReadResponse(method: string, data: any): any | null {
  if (method === "client.userBoot") return trimUserBoot(data);
  if (method === "client.counts") return trimCounts(data);
  if (method === "users.prefs.get") return trimUserPrefs(data);
  return null;
}
