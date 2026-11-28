import { defineQuery } from "@slock/plugins/query/client/api";
import { replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { RawCounts } from "@slock/types";

export type CountsReply = { notifications?: Record<string, number>; unreads?: RawCounts };

export const counts = defineQuery<null, CountsReply>({
  load: async (_, { signal }) => {
    const data = await apiGet<CountsReply>("/api/counts", signal);
    if (!data.ok) throw replyError(data, "client.counts failed");
    return data;
  },
  maxAgeMs: 0,
  name: "counts",
});

export function fetchCounts(): Promise<CountsReply> {
  return counts.ensure(null);
}
