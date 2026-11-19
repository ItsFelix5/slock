import { service } from "@slock/core/solid";
import { apiGet, replyError } from "@slock/slack";
import type { RawCounts } from "@slock/types";
import { defineKey } from "../../../query/client/api";

const query = service("query");
const countsKey = defineKey("counts");

type CountsReply = { notifications?: Record<string, number>; unreads?: RawCounts };

export function fetchCounts(): Promise<CountsReply> {
  return query.client.query({
    queryFn: async () => {
      const data = await apiGet<CountsReply>("/api/counts");
      if (!data.ok) throw replyError(data, "client.counts failed");
      return data;
    },
    queryKey: countsKey(),
    staleTime: 0,
  });
}
