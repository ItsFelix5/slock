import { defineQuery } from "@slock/plugins/query/client/api";
import { replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { UserId } from "@slock/types";

export const userDnd = defineQuery<UserId, number | null>({
  load: async (userId, { signal }) => {
    const data = await apiGet<{ pausedUntil: number | null }>(`/api/dnd/users/${userId}`, signal);
    if (!data.ok) throw replyError(data, "dnd lookup failed");
    return data.pausedUntil;
  },
  name: "userDnd",
});
