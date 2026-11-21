import { defineQuery } from "@slock/plugins/query/client/api";
import { fetchChannelManagerIds, fetchChannelMembers } from "@slock/plugins/slack/client/api";
import type { ChannelId, UserId } from "@slock/types";

export const channelRosters = defineQuery<ChannelId, Set<UserId>>({
  load: async (channelId) => {
    const ids = new Set<UserId>();
    async function collect(filter: "everyone" | "apps") {
      let cursor: string | undefined;
      do {
        const page = await fetchChannelMembers(channelId, filter, cursor);
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
  load: async (channelId) => new Set(await fetchChannelManagerIds(channelId)),
  name: "channelManagers",
});
