import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import { defineQuery } from "../../../query/client/api";
import { fetchAppHome } from "../fetch";

const dms = service("dms");
const users = service("users");

const appHome = defineQuery<ChannelId, Awaited<ReturnType<typeof fetchAppHome>>>({
  load: fetchAppHome,
  name: "appHome",
});

export function useAppHome(channelId: () => ChannelId) {
  return appHome.state(() => {
    const id = channelId();
    const userId = dms.dmById(id)?.userId;
    return userId && users.userById(userId)?.isBot ? id : undefined;
  });
}
