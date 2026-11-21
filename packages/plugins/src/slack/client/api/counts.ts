import { apiGet, replyError } from "@slock/slack";
import type { RawCounts } from "@slock/types";
import { defineQuery } from "../../../query/client/api";

type CountsReply = { notifications?: Record<string, number>; unreads?: RawCounts };

const counts = defineQuery<null, CountsReply>({
  load: async () => {
    const data = await apiGet<CountsReply>("/api/counts");
    if (!data.ok) throw replyError(data, "client.counts failed");
    return data;
  },
  maxAgeMs: 0,
  name: "counts",
});

export function fetchCounts(): Promise<CountsReply> {
  return counts.ensure(null);
}

export function fetchLatestCounts(): Promise<CountsReply> {
  return counts.refresh(null);
}
