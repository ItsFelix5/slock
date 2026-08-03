// biome-ignore-all lint/style/useNamingConvention: Slack payloads retain their wire field names.

import type { Credentials } from "../auth.ts";
import { jsonResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";
import {
  trimChannel,
  trimChannelSections,
  trimCountGroups,
  trimUser,
} from "../trim/slackEntities.ts";

function trimUserBoot(data: any): any {
  if (!data.ok) return data;
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
    name: group?.name,
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
  if (!data.ok) return data;
  return {
    ...trimCountGroups(data, (group: any) => ({
      has_unreads: group?.has_unreads,
      id: group?.id,
      is_unread: group?.is_unread,
      last_read: group?.last_read,
      latest: group?.latest,
      mention_count: group?.mention_count,
      mention_count_display: group?.mention_count_display,
      unread_count: group?.unread_count,
      unread_count_display: group?.unread_count_display,
    })),
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
  if (!data.ok) return data;
  const prefs = data.prefs ?? {};
  return {
    ok: true,
    prefs: Object.fromEntries(USER_PREF_KEYS.map((key) => [key, prefs[key]])),
  };
}

function trimDndInfo(data: any): any {
  if (!data.ok) return data;
  return { ok: true, snooze_enabled: data.snooze_enabled, snooze_endtime: data.snooze_endtime };
}

// These calls seed account-wide state used throughout the mounted shell. They are
// one app-level bootstrap operation; view-specific data such as sections, history,
// pins and drafts deliberately stays out and is loaded only by its owning view.
export async function bootstrapResponse(
  creds: Credentials | null,
  acceptEncoding: string | null,
  includeSections: boolean,
): Promise<Response> {
  const [rawBoot, rawCounts, rawPrefs, rawDnd, rawSections] = await Promise.all([
    callSlack("client.userBoot", {}, creds),
    callSlack("client.counts", {}, creds).catch(() => ({ ok: false })),
    callSlack("users.prefs.get", {}, creds),
    callSlack("dnd.info", {}, creds),
    includeSections
      ? callSlack("users.channelSections.list", {}, creds)
      : Promise.resolve(undefined),
  ]);
  return jsonResponse(
    {
      boot: trimUserBoot(rawBoot),
      counts: trimCounts(rawCounts),
      dnd: trimDndInfo(rawDnd),
      prefs: trimUserPrefs(rawPrefs),
      sections: rawSections
        ? rawSections.ok
          ? trimChannelSections(rawSections)
          : rawSections
        : undefined,
    },
    creds,
    acceptEncoding,
  );
}
