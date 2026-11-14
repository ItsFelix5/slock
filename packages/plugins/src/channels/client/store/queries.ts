import { queryOptions } from "@tanstack/solid-query";
import { defineKey } from "../../../query/client/api";
import { fetchChannelManagerIds, fetchChannelMembers } from "../../../slack/client/api";

const channelRostersKey = defineKey<[string]>("channelRosters");
const channelManagersKey = defineKey<[string]>("channelManagers");

export function channelRosterQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: channelRostersKey(channelId),
    queryFn: async () => {
      const ids = new Set<string>();
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

export function channelManagerQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: channelManagersKey(channelId),
    queryFn: async () => new Set(await fetchChannelManagerIds(channelId)),
  });
}
