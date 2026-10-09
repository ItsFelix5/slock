import { queryOptions } from "@tanstack/solid-query";
import { fetchChannelManagerIds, fetchChannelMembers } from "../../../api";

export function channelRosterQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["channelRosters", channelId],
    queryFn: async () => {
      const ids = new Set<string>();
      for (const filter of ["everyone", "apps"] as const) {
        let cursor: string | undefined;
        do {
          const page = await fetchChannelMembers(channelId, filter, cursor);
          for (const member of page.members) ids.add(member.id);
          cursor = page.nextCursor;
        } while (cursor);
      }
      return ids;
    },
  });
}

export function channelManagerQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["channelManagers", channelId],
    queryFn: async () => new Set(await fetchChannelManagerIds(channelId)),
  });
}
