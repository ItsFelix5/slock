import { defineQuery } from "@slock/plugins/query/client/api";
import { fetchChannelManagerIds, fetchChannelMembers } from "@slock/plugins/slack/client/api";
import type { Channel, ChannelId, UserId } from "@slock/types";
import { fetchChannel } from "../requests/channels";

const MISSING_RETRY_MS = 30_000;

export const channelLookup = defineQuery<ChannelId, Channel | null>({
  gcMs: Number.POSITIVE_INFINITY,
  load: fetchChannel,
  maxAgeMs: (channel) => (channel ? Number.POSITIVE_INFINITY : MISSING_RETRY_MS),
  name: "channelLookup",
  revalidates: false,
});

export const channelRosters = defineQuery<ChannelId, Set<UserId>>({
  load: async (channelId, { signal }) => {
    const ids = new Set<UserId>();
    async function collect(filter: "everyone" | "apps") {
      let cursor: string | undefined;
      do {
        const page = await fetchChannelMembers(channelId, filter, cursor, undefined, signal);
        for (const member of page.members) ids.add(member.id);
        cursor = page.nextCursor;
      } while (cursor);
    }
    await Promise.all([collect("everyone"), collect("apps")]);
    return ids;
  },
  name: "channelRosters",
});

export const channelManagers = defineQuery<ChannelId, Set<UserId>>({
  load: async (channelId, { signal }) => new Set(await fetchChannelManagerIds(channelId, signal)),
  maxAgeMs: 60_000,
  name: "channelManagers",
});
