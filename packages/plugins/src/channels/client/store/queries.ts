import type { ChannelId, UserId } from "@slock/types";
import { queryOptions } from "@tanstack/solid-query";
import { defineKey } from "../../../query/client/api";
import { fetchChannelManagerIds, fetchChannelMembers } from "../../../slack/client/api";

const channelRostersKey = defineKey<[ChannelId]>("channelRosters");
const channelManagersKey = defineKey<[ChannelId]>("channelManagers");

export function channelRosterQueryOptions(channelId: ChannelId) {
  return queryOptions({
    queryKey: channelRostersKey(channelId),
    queryFn: async () => {
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
  });
}

export function channelManagerQueryOptions(channelId: ChannelId) {
  return queryOptions({
    queryKey: channelManagersKey(channelId),
    queryFn: async () => new Set(await fetchChannelManagerIds(channelId)),
  });
}
