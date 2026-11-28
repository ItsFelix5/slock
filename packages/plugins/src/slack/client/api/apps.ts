import { defineQuery } from "@slock/plugins/query/client/api";
import { parseUserId, replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { UserId } from "@slock/types";

interface AppProfileArg {
  appId: string;
  botId?: string;
}

export const appProfile = defineQuery<AppProfileArg, { desc?: string; userId?: UserId }>({
  load: async ({ appId, botId }, { signal }) => {
    const query = botId ? `?bot=${encodeURIComponent(botId)}` : "";
    const data = await apiGet<{ desc?: string; userId?: string }>(
      `/api/apps/${appId}/profile${query}`,
      signal,
    );
    if (!data.ok) throw replyError(data, "apps.profile.get failed");
    return { desc: data.desc, userId: data.userId ? parseUserId(data.userId) : undefined };
  },
  name: "appProfile",
});
