// biome-ignore-all lint/style/useNamingConvention: Slack payloads retain their wire field names.

import type { Credentials } from "../auth.ts";
import { jsonResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";
import {
  trimActivityCounts,
  trimChannel,
  trimCountGroups,
  trimUser,
} from "../trim/slackEntities.ts";

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
    name: group?.name,
    properties: group?.properties
      ? { has_custom_mpdm_name: group.properties.has_custom_mpdm_name }
      : undefined,
    updated: group?.updated,
  });
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimChannel) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimIm) : data.ims,
    is_open: Array.isArray(data.is_open) ? data.is_open : undefined,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimMpim) : data.mpims,
    self: trimUser(data.self),
    starred: Array.isArray(data.starred)
      ? data.starred.map((star: any) =>
          typeof star === "string" ? star : { channel: star?.channel, id: star?.id },
        )
      : data.starred,
    subteams: Array.isArray(data.subteams?.self) ? { self: data.subteams.self } : undefined,
  };
}

function trimBootstrapCounts(data: any): any {
  return {
    notifications: trimActivityCounts(data.activity_v2),
    unreads: trimCountGroups(data, (group: any) => ({
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
    ...Object.fromEntries(
      USER_PREF_KEYS.filter((key) => key !== "all_notifications_prefs").map((key) => [
        key,
        prefs[key],
      ]),
    ),
    notification_prefs: prefs.all_notifications_prefs,
  };
}

function trimDndInfo(data: any): any {
  if (!(data.snooze_enabled && data.snooze_endtime)) return null;
  return { endtime: data.snooze_endtime };
}

function trimSections(data: any): Record<string, any> {
  if (!Array.isArray(data.channel_sections)) return {};
  return Object.fromEntries(
    data.channel_sections
      .map((section: any) => {
        const id = section?.channel_section_id ?? section?.id;
        if (!id) return null;
        return [
          id,
          {
            channel_ids:
              section?.channel_ids ?? section?.channel_ids_page?.channel_ids ?? section?.channels,
            filtering: section?.sidebar,
            name: section?.name,
            type: section?.type,
          },
        ];
      })
      .filter(Boolean),
  );
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
  const errors = Object.fromEntries(
    [
      ["bootstrap", rawBoot],
      ["notification_prefs", rawPrefs],
      ["snooze", rawDnd],
      ["sections", rawSections],
    ]
      .filter(([, data]) => data && !data.ok)
      .map(([name, data]) => [name, data.error ?? `${name} failed`]),
  );
  const counts = rawCounts.ok ? trimBootstrapCounts(rawCounts) : {};

  return jsonResponse(
    {
      ...(rawBoot.ok ? trimUserBoot(rawBoot) : {}),
      ...(rawPrefs.ok ? trimUserPrefs(rawPrefs) : {}),
      ...counts,
      sections: rawSections?.ok ? trimSections(rawSections) : undefined,
      snooze: rawDnd.ok ? trimDndInfo(rawDnd) : undefined,
      error: Object.keys(errors).length > 0 ? errors : undefined,
    },
    creds,
    acceptEncoding,
  );
}
