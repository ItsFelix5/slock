import type { BootstrapPayload, BootstrapSection } from "@slock/types";
import { jsonResponse } from "../http/jsonResponse.ts";
import { type Route, route } from "../routes/router.ts";
import { callSlack, type SlackFailure, type SlackReply } from "../slackClient.ts";
import type {
  ChannelSectionsReply,
  CountsReply,
  DndReply,
  PrefsReply,
  UserBootReply,
} from "../slackReplies.ts";
import {
  isHostedChannel,
  trimActivityCounts,
  trimBootChannel,
  trimCountGroup,
  trimCountGroups,
} from "../trim/slackChannels.ts";
import { trimUser } from "../trim/slackEntities.ts";

function trimUserBoot(data: UserBootReply): BootstrapPayload {
  return {
    channels: data.channels?.filter((channel) => !isHostedChannel(channel)).map(trimBootChannel),
    ims: data.ims?.map((im) => ({
      created: im.created,
      id: im.id,
      is_open: im.is_open,
      updated: im.updated,
      user: im.user,
    })),
    is_open: data.is_open,
    mpims: data.mpims?.map((group) => ({
      created: group.created,
      id: group.id,
      is_open: group.is_open,
      members: group.members,
      name: group.name,
      properties: group.properties
        ? { has_custom_mpdm_name: group.properties.has_custom_mpdm_name }
        : undefined,
      updated: group.updated,
    })),
    self: data.self ? trimUser(data.self) : undefined,
    starred: data.starred?.map((star) =>
      typeof star === "string" ? star : { channel: star.channel, id: star.id },
    ),
    subteams: data.subteams?.self ? { self: data.subteams.self } : undefined,
  };
}

function trimBootstrapCounts(data: CountsReply): BootstrapPayload {
  return {
    notifications: trimActivityCounts(data.activity_v2),
    unreads: trimCountGroups(data, trimCountGroup),
  };
}

function trimUserPrefs({ prefs = {} }: PrefsReply): BootstrapPayload {
  return {
    channel_sections: prefs.channel_sections,
    emoji_use: prefs.emoji_use,
    frecency: prefs.frecency,
    frecency_ent_jumper: prefs.frecency_ent_jumper,
    frecency_jumper: prefs.frecency_jumper,
    muted_channels: prefs.muted_channels,
    notification_prefs: prefs.all_notifications_prefs,
  };
}

function trimDndInfo(data: DndReply): { endtime: number } | null {
  if (!(data.snooze_enabled && data.snooze_endtime)) return null;
  return { endtime: data.snooze_endtime };
}

function trimSections(data: ChannelSectionsReply): Record<string, BootstrapSection> {
  return Object.fromEntries(
    (data.channel_sections ?? []).flatMap((section) => {
      const id = section.channel_section_id ?? section.id;
      if (!id) return [];
      return [
        [
          id,
          {
            channel_ids:
              section.channel_ids ?? section.channel_ids_page?.channel_ids ?? section.channels,
            filtering: section.sidebar,
            name: section.name,
            type: section.type,
          },
        ],
      ];
    }),
  );
}

function failures(named: Record<string, SlackReply>): [string, SlackFailure][] {
  return Object.entries(named).flatMap(([name, data]) => (data.ok ? [] : [[name, data]]));
}

export const bootstrapRoutes: Route[] = [
  route("GET", "bootstrap", async ({ creds, acceptEncoding }) => {
    const [rawBoot, rawCounts, rawPrefs, rawDnd, rawSections] = await Promise.all([
      callSlack<UserBootReply>("client.userBoot", {}, creds),
      callSlack<CountsReply>("client.counts", {}, creds).catch(
        (): SlackFailure => ({
          error: "counts_failed",
          ok: false,
        }),
      ),
      callSlack<PrefsReply>("users.prefs.get", {}, creds),
      callSlack<DndReply>("dnd.info", {}, creds),
      callSlack<ChannelSectionsReply>("users.channelSections.list", {}, creds),
    ]);
    const failed = failures({
      bootstrap: rawBoot,
      notification_prefs: rawPrefs,
      sections: rawSections,
      snooze: rawDnd,
    });
    const errors = Object.fromEntries(
      failed.map(([name, data]) => [name, data.error || `${name} failed`]),
    );
    const retryAfter = Object.fromEntries(
      failed.flatMap(([name, data]) => (data.retry_after ? [[name, data.retry_after]] : [])),
    );

    const payload: BootstrapPayload = {
      ...(rawBoot.ok ? trimUserBoot(rawBoot) : {}),
      ...(rawPrefs.ok ? trimUserPrefs(rawPrefs) : {}),
      ...(rawCounts.ok ? trimBootstrapCounts(rawCounts) : {}),
      error: Object.keys(errors).length > 0 ? errors : undefined,
      retry_after: Object.keys(retryAfter).length > 0 ? retryAfter : undefined,
      sections: rawSections.ok ? trimSections(rawSections) : undefined,
      snooze: rawDnd.ok ? trimDndInfo(rawDnd) : undefined,
    };
    return jsonResponse(payload, creds, acceptEncoding);
  }),
];
