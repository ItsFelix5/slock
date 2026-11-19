import type { ChannelId } from "@slock/types";
import { service } from "@slock/core/solid";
import { createKeyedQuery, defineKey } from "../../../query/client/api";
import { APP_HOME_QUERY, fetchAppHome } from "../fetch";

const appHomeKey = defineKey<[ChannelId]>(APP_HOME_QUERY);
const dms = service("dms");
const users = service("users");

export function useAppHome(channelId: () => ChannelId) {
  return createKeyedQuery(() => {
    const id = channelId();
    const userId = dms.dmById(id)?.userId;
    if (!(userId && users.userById(userId)?.isBot)) return;
    return { queryFn: () => fetchAppHome(id), queryKey: appHomeKey(id) };
  });
}
